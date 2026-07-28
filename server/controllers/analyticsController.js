const pool = require('../config/db');

// Admin only — aggregated data for the Reporting & Analytics dashboard.
// Kept as one endpoint (rather than one per chart) to keep round-trips down;
// each piece is a small aggregate query, never a full row dump.
exports.getOverview = async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);

    const [
      trendResult,
      statusResult,
      districtResult,
      agentResult,
      todayResult,
    ] = await Promise.all([
      // Daily registration volume for the trend chart
      pool.query(
        `SELECT created_at::date AS date, COUNT(*) AS count
         FROM clients
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY created_at::date
         ORDER BY created_at::date ASC`
      ),
      // Overall status breakdown (feeds both the funnel and KYC pass/fail rate)
      pool.query(`SELECT status, COUNT(*) AS count FROM clients GROUP BY status`),
      // Geographic distribution
      pool.query(
        `SELECT district, COUNT(*) AS count
         FROM clients
         WHERE district IS NOT NULL AND district != ''
         GROUP BY district
         ORDER BY count DESC`
      ),
      // Agent performance leaderboard — only active agents, since pending
      // (not yet verified) and suspended agents shouldn't show up in
      // performance analytics.
      pool.query(
        `SELECT u.id, u.name, u.status AS agent_status,
                COUNT(c.id) AS total_registered,
                COUNT(c.id) FILTER (WHERE c.status = 'verified') AS verified_count,
                COUNT(c.id) FILTER (WHERE c.status = 'pending')  AS pending_count,
                COUNT(c.id) FILTER (WHERE c.status = 'rejected') AS rejected_count
         FROM users u
         LEFT JOIN clients c ON c.registered_by = u.id
         WHERE u.role = 'agent' AND u.status = 'active'
         GROUP BY u.id
         ORDER BY total_registered DESC, u.name ASC`
      ),
      // Today's registrations, for a quick "today" stat alongside the trend chart
      pool.query(`SELECT COUNT(*) AS count FROM clients WHERE created_at::date = CURRENT_DATE`),
    ]);

    const statusCounts = { verified: 0, pending: 0, rejected: 0 };
    statusResult.rows.forEach(r => { statusCounts[r.status] = parseInt(r.count); });

    const reviewed = statusCounts.verified + statusCounts.rejected;
    const kycPassRate = reviewed > 0 ? Math.round((statusCounts.verified / reviewed) * 100) : null;

    res.json({
      registrationTrend: trendResult.rows.map(r => ({ date: r.date, count: parseInt(r.count) })),
      statusBreakdown: statusCounts,
      kyc: {
        verified: statusCounts.verified,
        rejected: statusCounts.rejected,
        pending: statusCounts.pending,
        passRate: kycPassRate, // null when nothing has been reviewed yet
      },
      districtDistribution: districtResult.rows.map(r => ({ district: r.district, count: parseInt(r.count) })),
      agentLeaderboard: agentResult.rows.map(r => ({
        id: r.id,
        name: r.name,
        status: r.agent_status,
        totalRegistered: parseInt(r.total_registered),
        verified: parseInt(r.verified_count),
        pending: parseInt(r.pending_count),
        rejected: parseInt(r.rejected_count),
      })),
      todayCount: parseInt(todayResult.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
