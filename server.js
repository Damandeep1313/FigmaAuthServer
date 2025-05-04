const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
const port = 3000;

// Replace with your actual credentials
CLIENT_ID="5Sh39KCmwlHaLkUufqqfe1";
CLIENT_SECRET = "RfsizPyHo5EO6dmm27VXOLzodWhXeB";
CALLBACK_URL="http://localhost:3000/callback";

// Step 1: Build the Auth URL
app.get('/auth', (req, res) => {
  const state = crypto.randomBytes(20).toString('hex');  // Generate a random state
  const authUrl = `https://www.figma.com/oauth?client_id=${CLIENT_ID}&redirect_uri=${CALLBACK_URL}&scope=file_read&state=${state}&response_type=code`;
  res.redirect(authUrl);
});

// Step 2: Handle the Callback and Exchange Code for Token
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Error: Missing code or state');
  }

  try {
    // Step 3: Exchange the code for an access token
    const response = await axios.post('https://api.figma.com/v1/oauth/token', new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: CALLBACK_URL,
      code: code,
      grant_type: 'authorization_code'
    }));

    const { access_token, refresh_token } = response.data;
    res.send(`Access Token: ${access_token}<br>Refresh Token: ${refresh_token}`);

    // Step 4: Use the access token to make an authenticated API call
    const userResponse = await axios.get('https://api.figma.com/v1/me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    console.log(userResponse.data);  // Display user data
  } catch (error) {
    console.error('Error during token exchange:', error.response ? error.response.data : error.message);
    res.status(500).send('Error during authentication');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
