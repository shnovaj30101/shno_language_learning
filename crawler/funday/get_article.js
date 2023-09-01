const puppeteer = require('puppeteer');
const fs = require('fs');

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const isDirExist = function(str) {
    try {
        let result = fs.lstatSync(str).isDirectory();
        return result;
    } catch(e) {
        return false;
    }
};

const parse_content = async (page, args) => {
    let output_json = {};

    let articleInfo1 = await page.$eval('.ArticleInfo1 #class_f', (element) => element.textContent);
    let articleInfo2 = await page.$eval('.ArticleInfo2', (element) => element.textContent);

    let info1_regex = /(.*?)CEFR:(.*)/;
    let info1_match = articleInfo1.match(info1_regex);

    output_json.category = info1_match[1];
    output_json.rank = info1_match[2];

    let info2_regex = /文章序號:(\d+) Date:(\d{4}\/\d{2}\/\d{2})/;
    let info2_match = articleInfo2.match(info2_regex);

    output_json.article_id = info2_match[1];
    output_json.date = info2_match[2];

    let content_list = await page.$$eval('.art-art', (elements) => {
        return elements.map((element) => {
            const spans = element.querySelectorAll('span');
            const spanContents = Array.from(spans).map((span) => span.textContent.trim());
            return spanContents.join(' ');
        });
    });

    output_json.title = content_list[0];
    output_json.article = content_list.slice(1).join('\n');

    let trans_content_list = await page.$$eval('.Chinese', (elements) => {
        return elements.map((element) => element.textContent);
    });

    output_json.trans_title = trans_content_list[0];
    output_json.trans_article = trans_content_list.slice(1).join('\n');

    fs.appendFileSync(args.article_file, JSON.stringify(output_json) + '\n');
};

const main = async (args) => {
    try {

        if (!isDirExist(args.mp3_dir)) {
            fs.mkdirSync(args.mp3_dir);
        }

        let cookie_str = fs.readFileSync(args.cookies_file).toString();
        let cookie_arr = JSON.parse(cookie_str);

        const browser = await puppeteer.launch({headless:args.headless});
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36")

        await page.setCookie(...cookie_arr);

        await page.setViewport({
            width: 1920,
            height: 1080
        })

        let article_id = args.start_id;

        while (article_id >= args.end_id && article_id > 0) {
            let url = `https://funday.asia/learning2020/?rid=${article_id}`;
            await page.goto(url);

            let desc = await page.$eval('meta[name="description"]', (metaTag) => metaTag.getAttribute('content'));

            if (desc.trim().length > 0) {
                await parse_content(page, args);
            }

            article_id -= 1;
        }

        await sleep(3000);
    } catch (err) {
        console.log(err.stack);
        process.exit(-1);
    }
};

(async () => {
    if (require.main !== module) {
        return;
    }

    const parseArgs = require('minimist');
    const _args = parseArgs(
        process.argv.slice(2),
        {
            string: [ 'cookies_file', 'article_file', 'mp3_dir' ],
            boolean: [ 'headless' ],
            number: [ 'start_id', 'end_id' ],
            alias: {
                c: 'cookies_file',
                h: 'headless',
                s: 'start_id',
                e: 'end_id',
                a: 'article_file',
                m: 'mp3_dir',
            },
            default: {
                start_id: 20000,
                end_id: 0,
                cookies_file: 'cookie.txt',
                article_file: 'article_file',
                mp3_dir: 'funday_mp3',
            }
        }
    );

    await main(_args);

})();
