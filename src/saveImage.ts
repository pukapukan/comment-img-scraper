import axios from 'axios'
import fs from 'fs'

const fileExtensionPattern = /filename=(?<extension>\S*)/g

export default async (postingNo: string | number, imageUrl: string): Promise<string> => {
    const response = await axios.get(imageUrl, { responseType: 'stream' })
    const contentDisposition = response.headers['content-disposition']
    const match = fileExtensionPattern.exec(contentDisposition)
    if (!match) {
        throw new Error('Unable to get image extension from HTTP response')
    }
    const directory = `img/${postingNo}`
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true })
    }
    const filename = match[1]
    const filepath = `${directory}/${filename}`

    response.data.pipe(fs.createWriteStream(filepath))
    return filename
}

