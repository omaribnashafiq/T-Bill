const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : window.location.origin + '/api';

const api = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  async request(method, path, body, isFormData = false) {
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    if (res.status === 401) {
      this.clearAuth();
      showLogin();
      throw new Error('Session expired');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body, isFormData) { return this.request('POST', path, body, isFormData); },
  patch(path, body, isFormData) { return this.request('PATCH', path, body, isFormData); },
  delete(path) { return this.request('DELETE', path); },

  download(path, filename) {
    const a = document.createElement('a');
    a.href = `${API_BASE}${path}`;
    a.download = filename;
    a.target = '_blank';
    if (this.token) {
      fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${this.token}` } })
        .then(r => r.blob())
        .then(blob => {
          a.href = URL.createObjectURL(blob);
          a.click();
        });
    }
  }
};
