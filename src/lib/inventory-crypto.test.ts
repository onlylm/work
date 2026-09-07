import {beforeEach,describe,expect,it} from "vitest";
import {decryptPayload,encryptPayload,payloadHash} from "./inventory-crypto";

describe("inventory crypto",()=>{
  beforeEach(()=>{process.env.INVENTORY_ENCRYPTION_KEY="test-key-for-unit-tests-only-32b";});

  it("加解密往返一致",()=>{
    const plain="user@example.com----password123";
    expect(decryptPayload(encryptPayload(plain))).toBe(plain);
  });

  it("相同内容生成稳定哈希",()=>{
    const a=payloadHash("ws","prod","abc");
    const b=payloadHash("ws","prod","abc");
    expect(a).toBe(b);
    expect(a).not.toBe(payloadHash("ws","prod","abcd"));
  });
});
