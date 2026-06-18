import axios from "axios";

const api = axios.create({
  // Live Railway Backend URL
  baseURL: "https://emailautomation-production-eb9f.up.railway.app/api/",
});

export default api;