const { getWeatherData } = require('../services/weatherService');

/**
 * GET /api/weather
 * Returns 7-day weather advisory based on user location
 */
const getWeatherAdvisory = async (req, res) => {
  try {
    const { lat, lon } = req.query;

    // Use query params if provided, otherwise fallback to User's registered location
    const latitude = lat || req.user.location.coordinates[1];
    const longitude = lon || req.user.location.coordinates[0];

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Location (lat/lon) is required.' });
    }

    const weatherData = await getWeatherData(latitude, longitude);

    res.status(200).json({
      success: true,
      data: weatherData
    });
  } catch (error) {
    console.error('[WEATHER] Controller Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getWeatherAdvisory };
