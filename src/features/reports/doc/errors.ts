// 문서 양식 오류. 어느 구역이 왜 틀렸는지 담는다. 브라우저 쪽 렌더러도 쓰므로 파서 의존성을 두지 않는다.
export class DocError extends Error {
  constructor(where: string, message: string) {
    super(`[${where}] ${message}`)
    this.name = 'DocError'
  }
}
