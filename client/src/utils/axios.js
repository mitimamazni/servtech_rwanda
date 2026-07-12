import axios from 'axios';
import toast from 'react-hot-toast';

// Set baseURL once at module load time — before any component renders
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Restore token from localStorage on page load
const token = localStorage.getItem('token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Render's free tier spins the backend down after ~15 min idle, so the very
// first request after a while away can fail with a plain network error (no
// response at all) while the instance cold-boots. That's most visible right
// when someone returns to the app — e.g. via the browser back button — after
// leaving it idle, which looks like a hard "failed to fetch" for no reason.
//
// GET requests are safe to retry automatically. Writes (POST/PUT/PATCH/DELETE)
// are NOT auto-retried here — if the original request actually reached the
// server before the connection dropped, blindly resubmitting could double
// up an action (e.g. a duplicate registration). Those just get a clearer
// error message so the calling code's own toast explains what happened.
let wakeToastShown = false;
axios.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    const isNetworkError = !err.response;

    if (isNetworkError && config) {
      const method = (config.method || 'get').toLowerCase();

      if (method === 'get' && !config._retried) {
        config._retried = true;
        if (!wakeToastShown) {
          wakeToastShown = true;
          toast('Reconnecting to server...', { icon: '🔄', id: 'server-wake' });
          setTimeout(() => { wakeToastShown = false; }, 15000);
        }
        await new Promise(r => setTimeout(r, 3000));
        return axios(config);
      }

      err.message = 'Could not reach the server — it may be waking up from idle. Please try again in a few seconds.';
    }

    return Promise.reject(err);
  }
);

export default axios;
