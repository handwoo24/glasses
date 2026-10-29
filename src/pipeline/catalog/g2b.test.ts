import { describe, expect, test } from 'vitest'
import { g2bItems, g2bUrl, stripPeople } from './g2b'

describe('나라장터 응답에서 사람 정보 지우기', () => {
  test('대표자·담당자 이름과 연락처 필드를 지운다', () => {
    const item = {
      prcbdrNm: '주식회사 삼성티엔지',
      prcbdrCeoNm: '홍길동',
      cntrctInsttOfclNm: '김담당',
      cntrctInsttOfclTelNo: '02-000-0000',
      ntceInsttOfclEmailAdrs: 'a@b.c',
      bidprcAmt: '1061675200',
    }
    expect(stripPeople(item)).toEqual({
      prcbdrNm: '주식회사 삼성티엔지',
      bidprcAmt: '1061675200',
    })
  })

  test('업체 목록 문자열(corpList)의 대표자 칸을 비운다', () => {
    const corpList =
      '[1^주계약업체^단독^주식회사 삼성티엔지^홍길동^대한민국^100^주식회사 삼성티엔지^^1098628406]'
    expect(stripPeople({ corpList })).toEqual({
      corpList:
        '[1^주계약업체^단독^주식회사 삼성티엔지^^대한민국^100^주식회사 삼성티엔지^^1098628406]',
    })
  })

  test('개찰업체 정보(opengCorpInfo)의 대표자 칸을 비운다', () => {
    expect(
      stripPeople({
        opengCorpInfo: '주식회사 삼성티엔지^1098628406^홍길동^1061675200^0',
      }),
    ).toEqual({
      opengCorpInfo: '주식회사 삼성티엔지^1098628406^^1061675200^0',
    })
  })

  test('대소문자가 다른 사람 필드도 지운다', () => {
    expect(
      stripPeople({
        ofclNm: '김담당',
        emailAdrs: 'a@b.c',
        chrgrNm: '박담당',
        x: 1,
      }),
    ).toEqual({ x: 1 })
  })

  test('중첩된 응답 전체를 훑는다', () => {
    const body = {
      response: {
        body: { items: [{ bidwinnrCeoNm: '홍길동', bidwinnrNm: '업체' }] },
      },
    }
    expect(stripPeople(body)).toEqual({
      response: { body: { items: [{ bidwinnrNm: '업체' }] } },
    })
  })
})

describe('나라장터 호출 주소', () => {
  test('이미 인코딩된 인증키는 그대로, 아니면 인코딩한다', () => {
    expect(g2bUrl('as/ScsbidInfoService', 'op', 'a%2Bb', {})).toContain(
      'serviceKey=a%2Bb&',
    )
    expect(g2bUrl('as/ScsbidInfoService', 'op', 'a+b', {})).toContain(
      'serviceKey=a%2Bb&',
    )
  })

  test('JSON으로 100건씩 받는 것이 기본이다', () => {
    const url = g2bUrl('ao/CntrctInfoService', 'getX', 'k', { inqryDiv: '1' })
    expect(url).toMatch(
      /^https:\/\/apis\.data\.go\.kr\/1230000\/ao\/CntrctInfoService\/getX\?/,
    )
    expect(url).toContain('numOfRows=100')
    expect(url).toContain('type=json')
    expect(url).toContain('inqryDiv=1')
  })
})

describe('응답 목록 꺼내기', () => {
  test('정상 응답의 items를 배열로', () => {
    expect(
      g2bItems({
        response: {
          header: { resultCode: '00' },
          body: { items: [{ a: 1 }], totalCount: 1 },
        },
      }),
    ).toEqual({ items: [{ a: 1 }], total: 1 })
  })

  test('items.item 꼴과 한 건짜리 객체도 배열로', () => {
    expect(
      g2bItems({
        response: {
          header: { resultCode: '00' },
          body: { items: { item: { a: 1 } }, totalCount: 1 },
        },
      }).items,
    ).toEqual([{ a: 1 }])
  })

  test('오류 응답은 코드와 메시지로 실패한다', () => {
    expect(() =>
      g2bItems({
        'nkoneps.com.response.ResponseError': {
          header: { resultCode: '07', resultMsg: '입력범위값 초과 에러' },
        },
      }),
    ).toThrow('07 입력범위값 초과 에러')
  })
})
