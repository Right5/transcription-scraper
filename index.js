const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

// Load config
const config = require('./config.json');
const { url, resultFolder } = config;

// Function to format and save transcription
const saveTranscription = (episodeTitle, transcriptions) => {
    const fileName = `${episodeTitle.replace(/[\/\\?%*:|"<>]/g, '-')}.txt`; // Replace invalid filename characters
    const filePath = path.join(resultFolder, fileName);

    let content = '';
    transcriptions.forEach(({ author, citation }) => {
        content += `- ${author}\n${citation}\n\n`;
    });

    fs.writeFileSync(filePath, content.trim());
    console.log(`Saved: ${filePath}`);
};

// Main function to scrape and process the webpage
const scrapeTranscriptions = async () => {
    try {
        // Clear and create the result folder
        fs.emptyDirSync(resultFolder);
        fs.ensureDirSync(resultFolder);

        // Fetch the webpage
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Process each podcast episode
        $('article').each((i, element) => {
            const episodeTitle = $(element).find('header .entry-title a').text().trim();
            const transcriptions = [];

            $(element).find('.ts-segment').each((j, segment) => {
                const author = $(segment).find('.ts-name').text().trim() || 'Unknown';
                const citation = $(segment).find('.ts-text').text().trim();
                if (citation) {
                    transcriptions.push({ author, citation });
                }
            });

            // Save transcription to file
            saveTranscription(episodeTitle, transcriptions);
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
};

// Run the scraper
scrapeTranscriptions();
