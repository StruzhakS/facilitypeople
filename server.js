// const express = require('express');
// const fetch = require('node-fetch');
// const cors = require('cors');
// const app = express();
// const PORT = 3001;

// app.use(cors());

// app.get('/geocode', async (req, res) => {
//   const q = req.query.q;
//   if (!q) return res.status(400).json({error: 'No query'});
//   const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ', Закарпатська область, Україна')}`;
//   try {
//     const response = await fetch(url, { headers: { 'User-Agent': 'JabilMap/1.0' } });
//     const data = await response.json();
//     res.json(data);
//   } catch (e) {
//     res.status(500).json({error: 'Geocoding failed'});
//   }
// });

// app.listen(PORT, () => console.log('Proxy running on port', PORT));
