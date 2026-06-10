const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || 'AIzaSyBZSXnjBhoGtg1zvP0LUF9LcoxMYj5kUO8');
    // We have to use the REST API directly to list models because the Node SDK doesn't expose it easily, or maybe it does? 
    // Wait, let's use fetch directly.
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + (process.env.GOOGLE_AI_API_KEY || 'AIzaSyBZSXnjBhoGtg1zvP0LUF9LcoxMYj5kUO8'));
    const data = await res.json();
    console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
  } catch (err) {
    console.error(err);
  }
}
listModels();
