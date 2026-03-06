// routes/verify.js - Route verifikasi Cloudflare Turnstile

const express = require("express");
const axios = require("axios");
const router = express.Router();

// POST /api/verify-turnstile - Verifikasi token Turnstile
router.post("/", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: "Token Turnstile tidak ada" });
  }

  try {
    const response = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY || "",
        response: token,
        remoteip: req.ip
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    if (response.data.success) {
      return res.json({ success: true });
    } else {
      return res.status(400).json({ success: false, message: "Verifikasi Turnstile gagal" });
    }
  } catch (e) {
    console.error("Turnstile error:", e.message);
    return res.status(500).json({ success: false, message: "Gagal memverifikasi Turnstile" });
  }
});

module.exports = router;
