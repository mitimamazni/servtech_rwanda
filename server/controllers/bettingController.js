const pool = require('../config/db');

// ── Client-facing ────────────────────────────────────────────────────────

// List matches open for betting (upcoming/live). Any logged-in client.
exports.getMatches = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, sport, league, home_team, away_team, start_time, status, odds_home, odds_draw, odds_away
       FROM matches
       WHERE status IN ('upcoming', 'live')
       ORDER BY start_time ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Place a bet. Client only — deducts stake from wallet, records the bet as
// 'pending' against the match, in the same betting_activity table the
// dashboards already read from.
exports.placeBet = async (req, res) => {
  const { match_id, selection, stake } = req.body;

  if (!match_id || !selection || !['home', 'draw', 'away'].includes(selection)) {
    return res.status(400).json({ message: 'match_id and a valid selection (home/draw/away) are required' });
  }
  const stakeAmount = parseFloat(stake);
  if (!stakeAmount || stakeAmount <= 0) {
    return res.status(400).json({ message: 'Stake must be a positive amount' });
  }

  try {
    const clientResult = await pool.query(
      `SELECT id, status, is_active, wallet_balance FROM clients WHERE user_id = $1`,
      [req.user.id]
    );
    if (clientResult.rows.length === 0) return res.status(404).json({ message: 'Client profile not found' });
    const client = clientResult.rows[0];

    if (client.status !== 'verified') {
      return res.status(403).json({ message: 'Your account must be verified before you can place bets' });
    }
    if (!client.is_active) {
      return res.status(403).json({ message: 'Your account is deactivated' });
    }

    const matchResult = await pool.query(`SELECT * FROM matches WHERE id = $1`, [match_id]);
    if (matchResult.rows.length === 0) return res.status(404).json({ message: 'Match not found' });
    const match = matchResult.rows[0];

    if (match.status !== 'upcoming' && match.status !== 'live') {
      return res.status(400).json({ message: 'This match is no longer open for betting' });
    }
    if (selection === 'draw' && match.odds_draw === null) {
      return res.status(400).json({ message: 'Draw is not a valid outcome for this match' });
    }

    if (parseFloat(client.wallet_balance) < stakeAmount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    const odds = selection === 'home' ? match.odds_home : selection === 'away' ? match.odds_away : match.odds_draw;
    const potentialPayout = Math.round(stakeAmount * parseFloat(odds) * 100) / 100;
    const newBalance = Math.round((parseFloat(client.wallet_balance) - stakeAmount) * 100) / 100;
    const gameLabel = `${match.home_team} vs ${match.away_team}`;

    await pool.query('BEGIN');
    try {
      await pool.query(`UPDATE clients SET wallet_balance = $1 WHERE id = $2`, [newBalance, client.id]);

      await pool.query(
        `INSERT INTO wallet_transactions (client_id, type, amount, balance_after, reference)
         VALUES ($1, 'bet_stake', $2, $3, $4)`,
        [client.id, -stakeAmount, newBalance, gameLabel]
      );

      const betResult = await pool.query(
        `INSERT INTO betting_activity (client_id, match_id, game, selection, odds, potential_payout, amount, outcome)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
        [client.id, match.id, gameLabel, selection, odds, potentialPayout, stakeAmount]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
        [req.user.id, client.id, 'PLACE_BET', `Bet ${stakeAmount} RWF on ${selection} (${gameLabel}) @ ${odds}`]
      );

      await pool.query('COMMIT');
      res.status(201).json({ bet: betResult.rows[0], wallet_balance: newBalance });
    } catch (txErr) {
      await pool.query('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Admin/agent-facing ───────────────────────────────────────────────────

// All matches, any status — for the admin sportsbook management page.
exports.getAllMatches = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM matches ORDER BY start_time DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createMatch = async (req, res) => {
  const { sport, league, home_team, away_team, start_time, odds_home, odds_draw, odds_away } = req.body;
  if (!home_team || !away_team || !start_time || !odds_home || !odds_away) {
    return res.status(400).json({ message: 'home_team, away_team, start_time, odds_home and odds_away are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO matches (sport, league, home_team, away_team, start_time, odds_home, odds_draw, odds_away, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [sport || 'football', league || null, home_team, away_team, start_time, odds_home, odds_draw || null, odds_away, req.user.id]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_MATCH', `Created match: ${home_team} vs ${away_team}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Settle a match: set the result, mark every pending bet on it won/lost, and
// credit winners' wallets with their potential_payout.
exports.settleMatch = async (req, res) => {
  const { id } = req.params;
  const { result } = req.body;
  if (!['home', 'draw', 'away'].includes(result)) {
    return res.status(400).json({ message: "result must be 'home', 'draw', or 'away'" });
  }

  try {
    const matchResult = await pool.query(`SELECT * FROM matches WHERE id = $1`, [id]);
    if (matchResult.rows.length === 0) return res.status(404).json({ message: 'Match not found' });
    const match = matchResult.rows[0];
    if (match.status === 'finished') return res.status(400).json({ message: 'Match already settled' });

    await pool.query('BEGIN');
    try {
      await pool.query(`UPDATE matches SET status = 'finished', result = $1 WHERE id = $2`, [result, id]);

      const pendingBets = await pool.query(
        `SELECT * FROM betting_activity WHERE match_id = $1 AND outcome = 'pending'`,
        [id]
      );

      for (const bet of pendingBets.rows) {
        const won = bet.selection === result;
        await pool.query(
          `UPDATE betting_activity SET outcome = $1 WHERE id = $2`,
          [won ? 'win' : 'loss', bet.id]
        );

        if (won) {
          const clientRow = await pool.query(`SELECT wallet_balance FROM clients WHERE id = $1`, [bet.client_id]);
          const newBalance = Math.round((parseFloat(clientRow.rows[0].wallet_balance) + parseFloat(bet.potential_payout)) * 100) / 100;
          await pool.query(`UPDATE clients SET wallet_balance = $1 WHERE id = $2`, [newBalance, bet.client_id]);
          await pool.query(
            `INSERT INTO wallet_transactions (client_id, type, amount, balance_after, reference)
             VALUES ($1, 'bet_payout', $2, $3, $4)`,
            [bet.client_id, bet.potential_payout, newBalance, bet.game]
          );
        }
      }

      await pool.query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [req.user.id, 'SETTLE_MATCH', `Settled match ${match.home_team} vs ${match.away_team} — result: ${result} (${pendingBets.rows.length} bets settled)`]
      );

      await pool.query('COMMIT');
      res.json({ message: 'Match settled', bets_settled: pendingBets.rows.length });
    } catch (txErr) {
      await pool.query('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// All bets across all clients — admin oversight view.
exports.getAllBets = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, c.first_name, c.last_name, c.id_number
       FROM betting_activity b
       JOIN clients c ON b.client_id = c.id
       ORDER BY b.placed_at DESC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Agent/admin tops up a client's wallet (simulated — no real payment rail).
exports.topUpWallet = async (req, res) => {
  const { clientId } = req.params;
  const amount = parseFloat(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ message: 'amount must be a positive number' });

  try {
    const clientResult = await pool.query(`SELECT * FROM clients WHERE id = $1`, [clientId]);
    if (clientResult.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    const client = clientResult.rows[0];

    if (req.user.role === 'agent' && client.registered_by !== req.user.id) {
      return res.status(403).json({ message: 'You can only top up clients you registered' });
    }

    const newBalance = Math.round((parseFloat(client.wallet_balance) + amount) * 100) / 100;
    await pool.query(`UPDATE clients SET wallet_balance = $1 WHERE id = $2`, [newBalance, clientId]);
    await pool.query(
      `INSERT INTO wallet_transactions (client_id, type, amount, balance_after, reference, created_by)
       VALUES ($1, 'topup', $2, $3, 'Manual top-up', $4)`,
      [clientId, amount, newBalance, req.user.id]
    );
    await pool.query(
      'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, clientId, 'WALLET_TOPUP', `Topped up ${amount} RWF`]
    );

    res.json({ wallet_balance: newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
