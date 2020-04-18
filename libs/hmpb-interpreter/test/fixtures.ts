import { join } from 'path'
import { Input } from '../src'
import { readImageData } from '../src/utils/readImageData'

const fixture = (filePath: string): Input => ({
  id: (): string => filePath,
  imageData: (): Promise<ImageData> => readImageData(filePath),
})

export const templatePage1 = fixture(
  join(__dirname, 'fixtures/template-2020-04-15-0001.jpg')
)
export const templatePage2 = fixture(
  join(__dirname, 'fixtures/template-2020-04-15-0002.jpg')
)
export const yvonneDavis = fixture(
  join(__dirname, 'fixtures/template-2020-04-15-0001-yvonne-davis.jpg')
)
export const fullVotesPage1 = fixture(
  join(__dirname, 'fixtures/template-2020-04-15-0001-full-votes.jpg')
)
export const fullVotesPage2 = fixture(
  join(__dirname, 'fixtures/template-2020-04-15-0002-full-votes.jpg')
)
export const croppedQRCode = fixture(
  join(__dirname, 'fixtures/croppedQRCode.jpg')
)
