const express = require('express');
const router = express.Router();
const Dream = require('../models/Dream');

router.get('/', async (req, res) => {
  try {
    const dreams = await Dream.find().sort({ createdAt: -1 });
    res.render('index', { dreams });
  } catch (err) {
    console.error(err);
    res.status(500).send('Something went wrong.');
  }
});

router.post('/dreams', async (req, res) => {
  try {
    const { username, description, imageData } = req.body;

    const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 70) {
      return res.status(400).json({ error: 'Description exceeds 70 words.' });
    }

    if (!imageData || !imageData.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid image data.' });
    }

    const dream = new Dream({ username, description, imageData });
    await dream.save();
    res.status(201).json({ success: true, dream });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save dream.' });
  }
});

router.delete('/dreams/:id', async (req, res) => {
  try {
    await Dream.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete dream.' });
  }
});

module.exports = router;
