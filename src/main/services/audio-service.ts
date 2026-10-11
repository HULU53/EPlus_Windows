import { app } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { randomId } from './crypto'
import { extractRawSpeexFromOgg } from './speex-ogg'

const execFileAsync = promisify(execFile)

export class AudioService {
  private readonly outputDirectory = join(app.getPath('userData'), 'cache', 'audio')

  constructor() {
    mkdirSync(this.outputDirectory, { recursive: true })
  }

  async convertToMp3(ffmpegPath: string, inputPath: string): Promise<string> {
    const outputPath = join(this.outputDirectory, `${randomId()}.mp3`)
    await this.run(ffmpegPath, [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '4',
      outputPath
    ])
    return outputPath
  }

  async convertToSpeex(ffmpegPath: string, inputPath: string): Promise<string> {
    const outputPath = join(this.outputDirectory, `${randomId()}.speex`)
    const oggPath = `${outputPath}.ogg.tmp.spx`
    await this.run(ffmpegPath, [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-codec:a',
      'libspeex',
      '-f',
      'spx',
      oggPath
    ])
    const rawSpeex = extractRawSpeexFromOgg(readFileSync(oggPath))
    if (rawSpeex.length === 0) {
      throw new Error('Speex 编码结果为空')
    }
    writeFileSync(outputPath, rawSpeex)
    if (existsSync(oggPath)) unlinkSync(oggPath)
    return outputPath
  }

  async generateSilentMp3(ffmpegPath: string): Promise<string> {
    const outputPath = join(this.outputDirectory, `${randomId()}-silence.mp3`)
    await this.run(ffmpegPath, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=16000:cl=mono',
      '-t',
      '1',
      '-vn',
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '9',
      outputPath
    ])
    return outputPath
  }

  async validateFfmpeg(ffmpegPath: string): Promise<void> {
    if (ffmpegPath === 'ffmpeg') {
      await this.run('ffmpeg', ['-version'])
      return
    }
    if (!existsSync(ffmpegPath)) {
      throw new Error(`FFmpeg 不存在：${ffmpegPath}`)
    }
    await this.run(ffmpegPath, ['-version'])
  }

  private async run(executable: string, args: string[]): Promise<void> {
    try {
      await execFileAsync(executable, args, {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`FFmpeg 执行失败：${message}`)
    }
  }
}


