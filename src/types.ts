export interface ScraperOptions {
    board: string
    targetCount: number
}

export interface CommentsAjaxResponse {
    total_cnt: number
    comment_cnt: number
    comments: Array<any>
    pagination: string
    allow_reply: number
}

export interface PostingData {
    title: string
    author: string
    posted: string
}
