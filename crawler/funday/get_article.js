const puppeteer = require('puppeteer');
const LineByLineReader = require('line-by-line');
const fs = require('fs');

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const isFileExist = function(str) {
    try {
        let result = fs.lstatSync(str).isFile();
        return result;
    } catch(e) {
        return false;
    }
};

const isDirExist = function(str) {
    try {
        let result = fs.lstatSync(str).isDirectory();
        return result;
    } catch(e) {
        return false;
    }
};

const parse_content = async (page, args, article_id) => {
    let output_json = {};
    try {
        let articleInfo1 = await page.$eval('.ArticleInfo1 #class_f', (element) => element.textContent);
        let articleInfo2 = await page.$eval('.ArticleInfo2', (element) => element.textContent);

        let info1_regex = /(.*?)CEFR:(.*)/;
        let info1_match = articleInfo1.match(info1_regex);

        output_json.category = info1_match[1];
        output_json.rank = info1_match[2];

        let info2_regex = /文章序號:(\d+) Date:(\d{4}\/\d{2}\/\d{2})/;
        let info2_match = articleInfo2.match(info2_regex);

        output_json.article_id = parseInt(info2_match[1]);
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
    } catch (err) {
        output_json.article_id = article_id;
        output_json.parse_error = true;
    }
    return output_json;
};

const read_json_line_file = async (filename) => {
    return new Promise(async (resolve,reject) => {
        let lines_info = {};
        let line_reader = new LineByLineReader(filename);

        line_reader.on('line', (line) => {
            line_reader.pause();
            if (line.length === 0) {
            } else {
                let line_info = JSON.parse(line);
                lines_info[line_info.article_id] = line_info;
            }
            line_reader.resume();
        });
        line_reader.on('error', (err) => {
            return reject(err);
        });
        line_reader.on('end', () => {
            return resolve(lines_info);
        });
    });
}

const page_setting = async (browser, args) => {
    let cookie_str = fs.readFileSync(args.cookies_file).toString();
    let cookie_arr = JSON.parse(cookie_str);

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36")

    await page.setCookie(...cookie_arr);

    await page.setViewport({
        width: 1920,
        height: 1080
    })

    return page;
}

const main = async (args) => {
    const browser = await puppeteer.launch({headless:args.headless});

    try {
        const page = await page_setting(browser, args);
        let article_id = args.start_id;

        while (article_id >= args.end_id && article_id > 0) {
            try {
                let url = `https://funday.asia/learning2020/?rid=${article_id}`;
                await page.goto(url);

                let desc = await page.$eval('meta[name="description"]', (metaTag) => metaTag.getAttribute('content'));

                if (desc.trim().length > 0) {
                    let output_json = await parse_content(page, args, article_id);
                    fs.appendFileSync(args.article_file, JSON.stringify(output_json) + '\n');
                } else {
                    let output_json = {};
                    output_json.article_id = article_id;
                    output_json.page_not_found = true;
                    fs.appendFileSync(args.article_file, JSON.stringify(output_json) + '\n');
                }

                article_id -= 1;
                await sleep(3000);
            } catch (err) {
                if (err instanceof puppeteer.errors.TimeoutError) {
                    await sleep(3000);
                } else {
                    throw err;
                }
            }
        }

    } catch (err) {
        console.log(err.stack);
        process.exit(-1);
    } finally {
        await browser.close();
    }
};

const incre_mode_main = async (args) => {
    let article_file_info = await read_json_line_file(args.article_file);
    const browser = await puppeteer.launch({headless:args.headless});

    try {
        const page = await page_setting(browser, args);
        let article_id = args.start_id;

        while (article_id >= args.end_id && article_id > 0) {
            try {
                if (!(article_id.toString() in article_file_info) || article_file_info[article_id.toString()].parse_error) {
                    let url = `https://funday.asia/learning2020/?rid=${article_id}`;
                    await page.goto(url);

                    let desc = await page.$eval('meta[name="description"]', (metaTag) => metaTag.getAttribute('content'));

                    if (desc.trim().length > 0) {
                        let output_json = await parse_content(page, args, article_id);
                        fs.appendFileSync(args.incr_file, JSON.stringify(output_json) + '\n');
                    } else {
                        let output_json = {};
                        output_json.article_id = article_id;
                        output_json.page_not_found = true;
                        fs.appendFileSync(args.incr_file, JSON.stringify(output_json) + '\n');
                    }
                    await sleep(3000);
                }

                article_id -= 1;
            } catch (err) {
                if (err instanceof puppeteer.errors.TimeoutError) {
                    await sleep(3000);
                } else {
                    throw err;
                }
            }
        }

    } catch (err) {
        console.log(err.stack);
        process.exit(-1);
    } finally {
        await browser.close();
    }
}

const merge_mode_main = async (args) => {
    let article_file_info = await read_json_line_file(args.article_file);
    let incre_file_info = await read_json_line_file(args.incr_file);

    let article_id = args.start_id;

    while (article_id >= args.end_id && article_id > 0) {
        if (article_id.toString() in article_file_info && !article_file_info[article_id.toString()].parse_error) {
            fs.appendFileSync(args.article_file, JSON.stringify(article_file_info[article_id.toString()]) + '\n');
        } else if (article_id.toString() in incre_file_info && !incre_file_info[article_id.toString()].parse_error) {
            fs.appendFileSync(args.incr_file, JSON.stringify(incre_file_info[article_id.toString()]) + '\n');
        }

        article_id -= 1;
    }
}

(async () => {
    if (require.main !== module) {
        return;
    }

    const parseArgs = require('minimist');
    const _args = parseArgs(
        process.argv.slice(2),
        {
            string: [ 'cookies_file', 'article_file', 'mp3_dir', 'incr_file' ],
            boolean: [ 'headless', 'incr_mode', 'merge_mode' ],
            number: [ 'start_id', 'end_id' ],
            alias: {
                c: 'cookies_file',
                h: 'headless',
                s: 'start_id',
                e: 'end_id',
                a: 'article_file',
                d: 'mp3_dir',
                i: 'incre_mode',
                m: 'merge_mode',
            },
            default: {
                start_id: 20000,
                end_id: 0,
                cookies_file: 'cookie.txt',
                article_file: 'article_file',
                incr_file: 'incr_file',
                mp3_dir: 'funday_mp3',
            }
        }
    );

    if (!isDirExist(_args.mp3_dir)) {
        fs.mkdirSync(_args.mp3_dir);
    }

    if (_args.incre_mode) {
        if (isFileExist(_args.incr_file)) {
            console.log("need use merge_mode or rename your incr_file.");
            process.exit(-1);
        }
        await incre_mode_main(_args);
    } else if (_args.merge_mode) {
        if (!isFileExist(_args.article_file)) {
            console.log("article_file not exist");
            process.exit(-1);
        }
        if (!isFileExist(_args.incr_file)) {
            console.log("incr_file not exist");
            process.exit(-1);
        }
        await merge_mode_main(_args);
    } else {
        if (isFileExist(_args.article_file)) {
            console.log("need use incre_mode or rename your artcile_file.");
            process.exit(-1);
        }
        await main(_args);
    }
})();
