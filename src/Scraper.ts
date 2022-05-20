import _ from "lodash";
import puppeteer, {Browser, Page} from "puppeteer";

import {CommentsAjaxResponse, ScraperOptions} from "./types";

const CommentImgSrcRegex = /data-src="(?<animated>\S*)"|<img class="written_dccon" src="(?<static>\S*)"/g

export default class Scraper {
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
        const comments = await this.fetchComments(pageUrls[0])
        await this.close();
    }

    private async close(): Promise<void> {
        const browser = await this.getBrowser();
        return browser.close();
    }

    private async newPage(): Promise<Page> {
        const browser = await this.getBrowser()
        return browser.newPage()
    }

    private shouldStop() {
        return this.count >= this.targetCount
    }

    private async listPostUrls(): Promise<string[]> {
        const page = await this.newPage()
        await page.goto(`${this.board}&page=${this.page}`)
        const list = await page.waitForSelector('.gall_list')
        const urls = await list.$$eval(
            'tr[data-no] a[view-msg]',
            (elements) => elements.flatMap((e:HTMLAnchorElement) => e.href));
        await page.close()
        return urls
    }

    private async fetchComments(pageUrl: string) {
        const page = await this.newPage()
        await page.goto(pageUrl)

        const ajax = (commentPage: number): Promise<CommentsAjaxResponse> => {
            return new Promise((resolve, reject) => {
                // @ts-ignore
                const id = getURLParameter('id')
                // @ts-ignore
                const no = getURLParameter('no')
                // @ts-ignore
                const esno = $('#e_s_n_o').val()
                // @ts-ignore
                $.ajax({
                    type: 'POST',
                    url: '/board/comment/',
                    cache: false,
                    async: false,
                    dataType: 'json',
                    data: {
                        id: id,
                        no: no,
                        cmt_id: id,
                        cmt_no: no,
                        focus_cno: undefined,
                        focus_pno: undefined,
                        // @ts-ignore
                        e_s_n_o: esno,
                        comment_page: commentPage,
                        sort: 'D',
                        prevCnt: 0,
                        board_type: undefined,
                        _GALLTYPE_: 'G'
                    },
                    success: resolve,
                    // @ts-ignore
                    fail: (xhr, textStatus, error) => reject(error)
                })
            })
        }

        let commentPage = await page.$eval('.cmt_paging a:last-child', (a: HTMLAnchorElement) => parseInt(a.innerText))

        const result = []
        while (commentPage > 0) {
            const response = await page.evaluate(ajax, commentPage)
            let requiredMainComment: string
            const filteredComments = response.comments
                .reverse()
                .filter(comment => {
                    const match = CommentImgSrcRegex.exec(comment.memo)
                    let isImageComment = match && (match.groups.animated || match.groups.static)

                    if (comment.c_no) {
                        requiredMainComment = comment.c_no
                    }

                    if (isImageComment) {
                        this.count += 1
                    }

                    return (isImageComment || comment.no === requiredMainComment)
                })
            result.push(...filteredComments)
            commentPage -= 1
        }

        return result.reverse()
    }
}
