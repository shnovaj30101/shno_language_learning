const puppeteer = require('puppeteer');
const cookie_arr = require('./my_cookie.js');
const http = require('http');
const LineByLineReader = require('line-by-line');
const _ = require('lodash');
const cheerio = require('cheerio');

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const console_log_article = ($) => {
    console.log('articleInfo')
    console.log($("div.ArticleInfo-1").text())
    if ($("div.ArticleInfo-1").text().trim().length === 0) {
        return;
    }
    console.log('img_url')
    console.log($("div.ArticleTitle-2 img").attr('src').replace('../..','https://funday.asia'))
    console.log('english')
    for (let elem of $("div.RightContent").find('.Step1-contentEn').toArray()) {
        if ($(elem).attr('id') !== undefined && $(elem).attr('id').startsWith('t')) {
            console.log('@ ' + $(elem).text())
        }
    }
    console.log('chinese')
    for (let elem of $("div.RightContent").find('font.tran_chinese').toArray()) {
        console.log('@ ' + $(elem).text())
    }
}

const article_content_parse = (content) => {
    const $ = cheerio.load(content);
    console_log_article($);


}

const get_article_content = (page) => {
    return new Promise(async (resolve,reject) => {
        const url_list_reader = new LineByLineReader('article_url_list');
        url_list_reader.on('line', async (line) => {
            console.log(line)
			url_list_reader.pause();

            let retry_times = 0;
            while (retry_times < 5) {
                try {
                    await page.goto(line, {waitUntil: 'load', timeout: 15000});
                    await sleep(3 * 1000);
                    console.log(await page.evaluate(() => {
                        return clock_num.join(' ');
                    }));
                    break;
                } catch (err) {
                    console.log('Error: '+err.message);
                    await sleep(3 * 1000);
                    retry_times += 1;
                    if (retry_times >= 5) {
                        break;
                    }
                    continue;
                }
            }

            if (retry_times < 5) {
                let article_content = await page.content();
                //console.log(article_content);
                //await sleep(10000);
                article_content_parse(article_content);
            }

            console.log('');
            url_list_reader.resume();
        });

        url_list_reader.on('error', async (err) => {
            return reject(err);
        });

        url_list_reader.on('end', async () => {
            return resolve(true);
        });
    });
}

(async () => {
    try {
        const browser = await puppeteer.launch({headless:true});
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36")

        await page.setCookie(...cookie_arr);

        await get_article_content(page);

    } catch (err) {
        console.log(err.stack);
        process.exit(-1);
    }
})();
