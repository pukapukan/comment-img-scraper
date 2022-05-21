import _ from "lodash";
import puppeteer, {Browser, Page} from "puppeteer";
import json2csv from 'json2csv'

import {Comment, CommentsAjaxResponse, PostData, ScraperOptions} from "./types";
import saveImage from "./saveImage";
import fs from "fs";

const CommentImgSrcRegex = /data-src="(?<animated>\S*)"|<img class="written_dccon" src="(?<static>\S*)"/g

export default class DcInsideCommentScraper {
    private readonly board: string;
    private readonly getBrowser: () => Promise<Browser>;
    private readonly targetCount: number;
    private readonly pageUrlGenerator: AsyncIterableIterator<string>;
    private readonly startDate: Date;
    private count: number;
    private page: number;

    constructor(options: ScraperOptions) {
        this.board = `https://gall.dcinside.com/board/lists/?id=${options.board}`;
        this.getBrowser = _.once(() => puppeteer.launch());
        this.targetCount = options.targetCount;
        this.startDate = new Date()
        this.count = 0;
        this.page = 1;
        this.pageUrlGenerator = this.postUrlGenerator()
    }

    async execute() {
        const postDataList: PostData[] = []
        while (!this.shouldStop()) {
            const { value: pageUrl, done } = await this.pageUrlGenerator.next()
            if (!pageUrl || done) {
                break
            }
            postDataList.push(await this.processPost(pageUrl))
        }
        await this.close();

        const writeStream = fs.createWriteStream(`output/${this.startDate.toISOString()}/posts.csv`)
        writeStream.write(json2csv.parse(postDataList))
        writeStream.close()
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

    private async * postUrlGenerator() {
        while (true) {
            const pageUrls = await this.listPostUrls()
            for (const url of pageUrls) {
                yield url
            }
            this.page += 1
        }
    }

    private async listPostUrls(): Promise<string[]> {
        const page = await this.newPage()
        await page.goto(`${this.board}&page=${this.page}`)
        const list = await page.waitForSelector('.gall_list')
        const urls = await list.$$eval(
            'tr.us-post[data-no] a[view-msg]',
            (elements) => elements.flatMap((e:HTMLAnchorElement) => e.href));
        await page.close()
        return urls
    }

    private async processPost(pageUrl: string): Promise<PostData> {
        const page = await this.newPage()
        await page.goto(pageUrl)

        const [id, title, author, postedDate] = await Promise.all([
            page.$eval('input#no', (e) => e.getAttribute('value')),
            page.$eval('.title_subject', (e) => e.textContent),
            page.$eval('.nickname.in', (e) => e.textContent),
            page.$eval('.gall_date', (e) => new Date(e.textContent).toISOString())
        ])

        const comments = await this.fetchComments(page)

        for (const c of comments) {
            if (c.imgUrl) {
                c.filename = await saveImage(`output/${this.startDate.toISOString()}/${id}`, c.id,  c.imgUrl) // TODO download multiple images in parallel (max TK)
            }
        }
        await page.close()
        const postData: PostData = { id, title, author, postedDate }

        const writeStream = fs.createWriteStream(`output/${this.startDate.toISOString()}/${id}_comments.csv`)
        writeStream.write(json2csv.parse(comments))
        writeStream.close()

        return postData
    }

    private async fetchComments(page: Page): Promise<Comment[]> {
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

        const result: Comment[] = []
        while (commentPage > 0) {
            const response = await page.evaluate(ajax, commentPage)
            let requiredMainComment: string
            const filteredComments = response.comments
                .reverse()
                .map((comment) : Comment => {
                    const match = CommentImgSrcRegex.exec(comment.memo)
                    const author: string = comment.name
                    const created: string = comment.reg_date
                    const id: string = comment.no
                    const imgUrl: string = match && (match.groups.animated || match.groups.static)
                    const isDeleted: string = comment.is_delete
                    const parentId: string = comment.c_no

                    return { author, created, id, imgUrl, isDeleted, parentId, filename: undefined }
                })
                .filter(comment => {
                    if (comment.parentId) {
                        requiredMainComment = comment.parentId
                    }
                    if (comment.imgUrl) {
                        this.count += 1
                    }
                    return (comment.imgUrl || comment.id === requiredMainComment)
                })
            result.push(...filteredComments)
            commentPage -= 1
        }

        return result.reverse()
    }
}
