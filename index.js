const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

// Get config file path from command-line argument or default to 'config.json'
const configFilePath = process.argv[2] || './config.json';
const config = require(configFilePath);

const { url, resultFolder, selectors } = config;

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

        // Fetch the webpage with a User-Agent header
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
            }
        });
        const $ = cheerio.load(data);

        // Process each podcast episode
        $(selectors.article).each((i, element) => {
            const episodeTitle = $(element).find(selectors.title).text().trim();
            const transcriptions = [];
            let lastAuthor = 'Unknown';

            $(element).find(selectors.segment).each((j, segment) => {
                let author = $(segment).find(selectors.author).text().trim() || lastAuthor;
                const citation = $(segment).find(selectors.citation).text().trim();
                if (citation) {
                    transcriptions.push({ author, citation });
                    lastAuthor = author; // Update last known author
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
