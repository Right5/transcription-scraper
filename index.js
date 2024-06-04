const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

// Read the config file
const configFilePath = process.argv[2] || './config.json';
let config;
let resultFolder;
let screenshotFolder;

try {
    config = require(configFilePath);
    console.log("Config file loaded:", config);
} catch (error) {
    console.error("Error reading config file:", error);
    process.exit(1);
}

function emptyAndCreateDirs() {
    // Ensure the result folder exists
    resultFolder = path.join(__dirname, config.resultFolder);
    fs.emptyDirSync(resultFolder);
    fs.ensureDirSync(resultFolder);

    // Ensure the screenshot folder exists
    screenshotFolder = path.join(__dirname, 'screenshots');
    fs.emptyDirSync(screenshotFolder);
    fs.ensureDirSync(screenshotFolder);
}

function translateXPathToCSS(xpath) {
    if (!xpath || (!xpath.startsWith('//') && !xpath.startsWith('.//')))
        return xpath;

    return xpath
        .replace(/\.\/{2}/g, ' ') // handle relative
        .replace(/\/{2}/g, ' ') // handle descendant
        .replace(/\[(\d+)\]/g, (match, p1) => `:nth-child(${p1})`)
        .replace(/\//g, ' > ') // handle child
        .replace(/@/g, '') // remove @ for attributes
        .replace(/\[contains\(([^,]+),\s*'([^']+)'\)\]/g, (match, p1, p2) => `[${p1}*='${p2}']`) // handle contains
        .replace(/\[([^=]+)=['"]?([^'"\]]+)['"]?\]/g, (match, p1, p2) => `[${p1}='${p2}']`); // handle equals
}

function saveTranscription (episodeTitle, transcriptions) {
    const fileName = `${episodeTitle.replace(/[\/\\?%*:|"<>]/g, '-')}.txt`; // Replace invalid filename characters
    const filePath = path.join(resultFolder, fileName);

    let content = '';
    transcriptions.forEach(({ author, citation }) => {
        content += `- ${author}\n${citation}\n\n`;
    });

    fs.writeFileSync(filePath, content.trim());
    console.log(`Saved: ${filePath}`);
}

async function getText(page, selector) {
    return page.$eval(selector, el => el.innerText);
}

async function getAllText(page, selector) {
    return page.$$eval(selector, nodes => nodes.map(n => n.innerText));
}

// run
(async () => {
    emptyAndCreateDirs();

    const browser = await puppeteer.launch({ headless: !config.debug }); // Set headless based on debug setting
    const page = await browser.newPage();

    try {
        await page.goto(config.url, { waitUntil: 'networkidle2' });

        if (config.debug) {
            await page.screenshot({ path: path.join(resultFolder, 'page_loaded.png') });
        }

        // Translate XPath selectors to CSS selectors
        const articleSelector = translateXPathToCSS(config.selectors.article);
        const titleSelector = translateXPathToCSS(config.selectors.title);
        const segmentSelector = translateXPathToCSS(config.selectors.segment);
        const authorSelector = translateXPathToCSS(config.selectors.author);
        const citationSelector = translateXPathToCSS(config.selectors.citation);

        if (config.debug) {
            console.log('-------');
            console.log(config.selectors.article)
            console.log(articleSelector)
            console.log('-------');
            console.log(config.selectors.title)
            console.log(titleSelector)
            console.log('-------');
            console.log(config.selectors.segment)
            console.log(segmentSelector)
            console.log('-------');
            console.log(config.selectors.author)
            console.log(authorSelector)
            console.log('-------');
            console.log(config.selectors.citation)
            console.log(citationSelector)
            console.log('-------');
        }

        await page.waitForSelector(articleSelector, { timeout: 30000 });

        if (config.debug) {
            await page.screenshot({ path: path.join(resultFolder, 'article_loaded.png') });
        }

        const articles = await page.$$(articleSelector);

        for (const article of articles) {
            const episodeTitle = await article.$eval(titleSelector, el => el.innerText.trim());
            const transcriptions = [];
            let lastAuthor = 'Unknown';

            const segments = await article.$$(segmentSelector);
            for (const segment of segments) {
                let author = await segment.$eval(authorSelector, el => el.innerText.trim()) || lastAuthor;
                const citation = await segment.$eval(citationSelector, el => el.innerText.trim());
                if (citation) {
                    transcriptions.push({ author, citation });
                    lastAuthor = author; // Update last known author
                }
            }

            // Save transcription to file
            saveTranscription(episodeTitle, transcriptions);
        }

        if (config.debug) {
            await page.screenshot({ path: path.join(resultFolder, 'data_extracted.png') });
        }

        if (!config.debug) {
            await browser.close();
        }
    } catch (error) {
        console.error('Error during scraping:', error);
        if (config.debug) {
            await page.screenshot({ path: path.join(resultFolder, 'error.png') });
        }
        if (!config.debug) {
            await browser.close();
        }
    }
})();
