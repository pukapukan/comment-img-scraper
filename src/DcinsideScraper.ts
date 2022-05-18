import _ from "lodash";
import puppeteer, {Browser} from "puppeteer";
import {ScraperOptions} from "./types";

export default class DCInsideScraper {
    private readonly board: string;
    private readonly getBrowser: () => Promise<Browser>;
    private readonly targetCount: number;
    private count: number;
    private page: number;

    constructor(options: ScraperOptions) {
        this.board = `https://gall.dcinside.com/board/lists/?id=${options.board}`;
        this.getBrowser = _.once(() => puppeteer.launch());
        this.targetCount = options.targetCount;
        this.count = 0;
        this.page = 1;
    }

    async execute() {
        const pageUrls = await this.listPostUrls();
        console.log(pageUrls);
        await this.close();
    }

    async close(): Promise<void> {
        const browser = await this.getBrowser();
        return browser.close();
    }

    private async listPostUrls(): Promise<string[]> {
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.goto(`${this.board}&page=${this.page}`);
        const list = await page.waitForSelector(".gall_list");
        return list.$$eval(
            "tr[data-no] a[view-msg]",
            (elements) => elements.flatMap(e => (e as HTMLAnchorElement).href));
    }
}
