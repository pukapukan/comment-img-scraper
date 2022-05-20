import axios from 'axios'
import fs from 'fs'

export default async (directory: string, prefix: string = '', imageUrl: string): Promise<string> => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true })
    }

    const response = await axios.get(imageUrl, { responseType: 'stream' })
    const contentDisposition = response.headers['content-disposition'] || ''
    let filename = contentDisposition.replace('attachment; filename=', '')
    if (!filename) {
        throw new Error('Unable to get image filename from HTTP response')
    }
    if (prefix) {
        filename = `${prefix}_${filename}`
    }
    const filepath = `${directory}/${filename}`

    response.data.pipe(fs.createWriteStream(filepath))
    return filename
}

