export function extractRawSpeexFromOgg(data: Buffer): Buffer {
  const packets: Buffer[] = []
  let current: Buffer[] = []
  let offset = 0

  while (offset + 27 <= data.length) {
    if (data.toString('ascii', offset, offset + 4) !== 'OggS') {
      throw new Error(`Ogg Speex 页头无效，offset=${offset}`)
    }
    const segmentCount = data[offset + 26]
    const segmentTableStart = offset + 27
    let payloadOffset = segmentTableStart + segmentCount
    if (payloadOffset > data.length) throw new Error('Ogg Speex 页表越界')

    for (let index = 0; index < segmentCount; index += 1) {
      const length = data[offset + 27 + index]
      const end = payloadOffset + length
      if (end > data.length) throw new Error('Ogg Speex 页载荷越界')
      current.push(data.subarray(payloadOffset, end))
      payloadOffset = end
      if (length < 255) {
        packets.push(Buffer.concat(current))
        current = []
      }
    }
    offset = payloadOffset
  }

  const headerIndex = packets.findIndex((packet) =>
    packet.subarray(0, 8).toString('ascii').startsWith('Speex')
  )
  const audioPackets =
    headerIndex >= 0 && packets.length >= headerIndex + 3
      ? packets.slice(headerIndex + 2)
      : packets
  return Buffer.concat(audioPackets)
}
