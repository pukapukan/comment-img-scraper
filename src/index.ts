import DcInsideCommentScraper from "./DcInsideCommentScraper";

const scraper = new DcInsideCommentScraper({ board:'hit', targetCount: 100 })
scraper.execute()
