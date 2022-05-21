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

export interface Comment {
    author: string
    created: string
    id: string
    imgUrl: string
    isDeleted: string
    parentId: string
    // should get populated once image has been downloaded
    filename: string | undefined
}

export interface PostData {
    id: string
    title: string
    author: string
    postedDate: string
}
