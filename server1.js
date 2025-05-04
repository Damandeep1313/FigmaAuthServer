require('dotenv').config();  // Load environment variables

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
const port = 3000;


app.use(express.json()); // This will parse JSON data from the body


// Access the environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL;

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



// Add this above the protected routes
function checkAuth(req, res, next) {
    const authHeader = req.headers.authorization;
  
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
  
    req.accessToken = authHeader.split(' ')[1];
    next();
  }

app.get('/me', checkAuth, async (req, res) => {
    try {
      const response = await axios.get('https://api.figma.com/v1/me', {
        headers: { Authorization: `Bearer ${req.accessToken}` }
      });
      res.json(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Unknown error' });
    }
  });

  app.get('/files', checkAuth, async (req, res) => {
    try {
      const userRes = await axios.get('https://api.figma.com/v1/me', {
        headers: { Authorization: `Bearer ${req.accessToken}` }
      });
  
      const userId = userRes.data.id;
      const filesRes = await axios.get(`https://api.figma.com/v1/users/${userId}/files`, {
        headers: { Authorization: `Bearer ${req.accessToken}` }
      });
  
      res.json(filesRes.data);
    } catch (error) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Unable to fetch files' });
    }
});

app.get('/file/:fileKey', checkAuth, async (req, res) => {
    const { fileKey } = req.params;
  
    try {
      const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
        headers: { Authorization: `Bearer ${req.accessToken}` }
      });
  
      res.json(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Unable to fetch file' });
    }
  });

  app.get('/file/:fileKey/nodes', checkAuth, async (req, res) => {
    const { fileKey } = req.params;
    const { ids } = req.query;
  
    if (!ids) {
      return res.status(400).json({ error: 'Missing required query param: ids' });
    }
  
    try {
      const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}/nodes`, {
        headers: { Authorization: `Bearer ${req.accessToken}` },
        params: { ids }
      });
  
      // Filter response to return only thumbnailUrls
      const nodes = response.data.nodes;
      const simplified = Object.entries(nodes).reduce((acc, [id, node]) => {
        acc[id] = {
          name: node.document.name,
          id: node.document.id,
          type: node.document.type,
          thumbnailUrl: response.data.thumbnailUrl || 'No thumbnail available'
        };
        return acc;
      }, {});
  
      res.json(simplified);
    } catch (error) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to fetch nodes' });
    }
  });
  
///This will allow you to pass node IDs and get their corresponding image URLs.
app.get('/file/:fileKey/images', checkAuth, async (req, res) => {
    const { fileKey } = req.params;  // Extract file key from the URL
    const { ids } = req.query;       // Extract node IDs from query string
  
    try {
      // Make the API call to Figma to fetch images for the given file and node IDs
      const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}/images`, {
        headers: { Authorization: `Bearer ${req.accessToken}` },
        params: { ids: ids }
      });
  
      res.json(response.data); // Send back the images data as JSON
    } catch (error) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Unable to fetch images' });
    }
  });
  
  
  // POST /file/comments - Add comments to a file

  app.post('/file/comments', checkAuth, async (req, res) => {
    const { fileKey, message, nodeId, nodeOffset } = req.body;
  
    if (!fileKey || !message || !nodeId || !nodeOffset) {
      return res.status(400).json({ error: 'Missing required fields: fileKey, message, nodeId, or nodeOffset' });
    }
  
    try {
      // Send the comment request to the Figma API
      const response = await axios.post(
        `https://api.figma.com/v1/files/${fileKey}/comments`,
        {
          message: message,
          client_meta: {
            node_id: nodeId,
            node_offset: {
              x: nodeOffset.x,
              y: nodeOffset.y
            }
          },
        },
        {
          headers: { Authorization: `Bearer ${req.accessToken}` },
        }
      );
  
      res.json(response.data);
    } catch (error) {
      // Log the error for debugging
      console.error('Error adding comment:', error.response ? error.response.data : error.message);
      
      // Respond with the error details
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Unable to add comment' });
    }
  });
  

  // Get projects for a team
app.get('/team/:teamId/projects', checkAuth, async (req, res) => {
    const { teamId } = req.params;
  
    try {
      const response = await axios.get(`https://api.figma.com/v1/teams/${teamId}/projects`, {
        headers: {
          Authorization: `Bearer ${req.accessToken}`
        }
      });
  
      res.json(response.data);
    } catch (error) {
      console.error('Error fetching team projects:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch team projects'
      });
    }
  });
  
  
  app.get('/team/:teamId', checkAuth, async (req, res) => {
    const { teamId } = req.params;
  
    try {
      const response = await axios.get(`https://api.figma.com/v1/teams/${teamId}`, {
        headers: {
          Authorization: `Bearer ${req.accessToken}`
        }
      });
      res.json(response.data);
    } catch (error) {
      console.error('Error fetching team info:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch team info'
      });
    }
  });


  
  
  

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
