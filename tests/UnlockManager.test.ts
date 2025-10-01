// unlock-manager.test.ts

import { describe, it, expect, beforeEach } from "vitest";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INSUFFICIENT_BALANCE = 102;
const ERR_ALREADY_UNLOCKED = 104;
const ERR_INVALID_AMOUNT = 106;
const ERR_INVALID_TIME = 107;
const ERR_NO_ESCROW = 109;
const ERR_BATCH_LIMIT = 110;
const ERR_PAUSED = 112;
const ERR_INVALID_EXPIRATION = 113;
const ERR_MODULE_NOT_FOUND = 114;
const ERR_USER_NOT_FOUND = 115;
const ERR_INVALID_PARAM = 116;
const ERR_ESCROW_ALREADY_CLAIMED = 117;
const ERR_INVALID_STATUS = 118;
const ERR_MAX_UNLOCKS_EXCEEDED = 119;

interface Unlock {
  expiration: number;
  paid: number;
  status: boolean;
}

interface Escrow {
  amount: number;
  timestamp: number;
  claimed: boolean;
}

interface ModuleInfo {
  price: number;
  creator: string;
}

interface Result<T> {
  ok: boolean;
  value: T | number;
}

class UnlockManagerMock {
  state: {
    contractOwner: string;
    tokenContract: string;
    registryContract: string;
    defaultExpiration: number;
    platformFeeRate: number;
    paused: boolean;
    maxBatchSize: number;
    maxUserUnlocks: number;
    userUnlocks: Map<string, Unlock>;
    escrows: Map<string, Escrow>;
    userUnlockCounts: Map<string, number>;
  } = {
    contractOwner: "ST1OWNER",
    tokenContract: "ST1TOKEN",
    registryContract: "ST1REGISTRY",
    defaultExpiration: 2592000,
    platformFeeRate: 5,
    paused: false,
    maxBatchSize: 10,
    maxUserUnlocks: 100,
    userUnlocks: new Map(),
    escrows: new Map(),
    userUnlockCounts: new Map(),
  };
  blockHeight: number = 100;
  caller: string = "ST1USER";
  tokenBalances: Map<string, number> = new Map([["ST1USER", 10000], ["ST1CONTRACT", 0]]);
  modules: Map<number, ModuleInfo> = new Map([[1, { price: 100, creator: "ST1CREATOR" }]]);

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      contractOwner: "ST1OWNER",
      tokenContract: "ST1TOKEN",
      registryContract: "ST1REGISTRY",
      defaultExpiration: 2592000,
      platformFeeRate: 5,
      paused: false,
      maxBatchSize: 10,
      maxUserUnlocks: 100,
      userUnlocks: new Map(),
      escrows: new Map(),
      userUnlockCounts: new Map(),
    };
    this.blockHeight = 100;
    this.caller = "ST1USER";
    this.tokenBalances = new Map([["ST1USER", 10000], ["ST1CONTRACT", 0]]);
    this.modules = new Map([[1, { price: 100, creator: "ST1CREATOR" }]]);
  }

  getUnlockInfo(user: string, moduleId: number): Unlock | null {
    return this.state.userUnlocks.get(`${user}-${moduleId}`) || null;
  }

  getEscrowInfo(user: string, moduleId: number): Escrow | null {
    return this.state.escrows.get(`${user}-${moduleId}`) || null;
  }

  isUnlocked(user: string, moduleId: number): boolean {
    const unlock = this.getUnlockInfo(user, moduleId);
    return unlock ? unlock.status && unlock.expiration >= this.blockHeight : false;
  }

  getUserUnlockCount(user: string): number {
    return this.state.userUnlockCounts.get(user) || 0;
  }

  setTokenContract(newContract: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.tokenContract = newContract;
    return { ok: true, value: true };
  }

  setRegistryContract(newContract: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.registryContract = newContract;
    return { ok: true, value: true };
  }

  setDefaultExpiration(newExp: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newExp <= 0 || newExp > 31536000) return { ok: false, value: ERR_INVALID_EXPIRATION };
    this.state.defaultExpiration = newExp;
    return { ok: true, value: true };
  }

  setPlatformFeeRate(newRate: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newRate > 10) return { ok: false, value: ERR_INVALID_PARAM };
    this.state.platformFeeRate = newRate;
    return { ok: true, value: true };
  }

  pauseContract(): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.paused = false;
    return { ok: true, value: true };
  }

  setMaxBatchSize(newSize: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newSize <= 0) return { ok: false, value: ERR_INVALID_PARAM };
    this.state.maxBatchSize = newSize;
    return { ok: true, value: true };
  }

  setMaxUserUnlocks(newMax: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_PARAM };
    this.state.maxUserUnlocks = newMax;
    return { ok: true, value: true };
  }

  unlockModule(moduleId: number, customExp: number | null): Result<boolean> {
    if (this.state.paused) return { ok: false, value: ERR_PAUSED };
    const info = this.modules.get(moduleId);
    if (!info) return { ok: false, value: ERR_MODULE_NOT_FOUND };
    const price = info.price;
    if (price <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    const exp = customExp || this.state.defaultExpiration;
    if (exp <= 0 || exp > 31536000) return { ok: false, value: ERR_INVALID_EXPIRATION };
    if (this.getUnlockInfo(this.caller, moduleId)) return { ok: false, value: ERR_ALREADY_UNLOCKED };
    const currentCount = this.getUserUnlockCount(this.caller);
    if (currentCount >= this.state.maxUserUnlocks) return { ok: false, value: ERR_MAX_UNLOCKS_EXCEEDED };
    const userBalance = this.tokenBalances.get(this.caller) || 0;
    if (userBalance < price) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    this.tokenBalances.set(this.caller, userBalance - price);
    this.tokenBalances.set("ST1CONTRACT", (this.tokenBalances.get("ST1CONTRACT") || 0) + price);
    this.state.escrows.set(`${this.caller}-${moduleId}`, { amount: price, timestamp: this.blockHeight, claimed: false });
    return { ok: true, value: true };
  }

  confirmUnlock(moduleId: number, user: string): Result<boolean> {
    const escrow = this.state.escrows.get(`${user}-${moduleId}`);
    if (!escrow) return { ok: false, value: ERR_NO_ESCROW };
    const info = this.modules.get(moduleId);
    if (!info) return { ok: false, value: ERR_MODULE_NOT_FOUND };
    if (this.caller !== info.creator) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (escrow.claimed) return { ok: false, value: ERR_ESCROW_ALREADY_CLAIMED };
    const price = escrow.amount;
    const fee = (price * this.state.platformFeeRate) / 100;
    const netPrice = price - fee;
    this.tokenBalances.set("ST1CONTRACT", (this.tokenBalances.get("ST1CONTRACT") || 0) - price);
    this.tokenBalances.set(this.state.contractOwner, (this.tokenBalances.get(this.state.contractOwner) || 0) + fee);
    this.tokenBalances.set(info.creator, (this.tokenBalances.get(info.creator) || 0) + netPrice);
    this.state.userUnlocks.set(`${user}-${moduleId}`, { expiration: this.blockHeight + this.state.defaultExpiration, paid: price, status: true });
    this.state.escrows.set(`${user}-${moduleId}`, { ...escrow, claimed: true });
    this.state.userUnlockCounts.set(user, (this.state.userUnlockCounts.get(user) || 0) + 1);
    return { ok: true, value: true };
  }

  refundEscrow(moduleId: number): Result<boolean> {
    const escrow = this.state.escrows.get(`${this.caller}-${moduleId}`);
    if (!escrow) return { ok: false, value: ERR_NO_ESCROW };
    if (escrow.claimed) return { ok: false, value: ERR_ESCROW_ALREADY_CLAIMED };
    if (this.blockHeight - escrow.timestamp <= 86400) return { ok: false, value: ERR_INVALID_TIME };
    const amount = escrow.amount;
    this.tokenBalances.set("ST1CONTRACT", (this.tokenBalances.get("ST1CONTRACT") || 0) - amount);
    this.tokenBalances.set(this.caller, (this.tokenBalances.get(this.caller) || 0) + amount);
    this.state.escrows.delete(`${this.caller}-${moduleId}`);
    return { ok: true, value: true };
  }

  batchUnlock(moduleIds: number[], customExps: (number | null)[]): Result<boolean> {
    if (this.state.paused) return { ok: false, value: ERR_PAUSED };
    if (moduleIds.length > this.state.maxBatchSize) return { ok: false, value: ERR_BATCH_LIMIT };
    for (let i = 0; i < moduleIds.length; i++) {
      const result = this.unlockModule(moduleIds[i], customExps[i]);
      if (!result.ok) return result;
    }
    return { ok: true, value: true };
  }

  revokeUnlock(moduleId: number, user: string): Result<boolean> {
    const info = this.modules.get(moduleId);
    if (!info) return { ok: false, value: ERR_MODULE_NOT_FOUND };
    const unlock = this.state.userUnlocks.get(`${user}-${moduleId}`);
    if (!unlock) return { ok: false, value: ERR_USER_NOT_FOUND };
    if (this.caller !== info.creator) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.userUnlocks.set(`${user}-${moduleId}`, { ...unlock, status: false });
    this.state.userUnlockCounts.set(user, (this.state.userUnlockCounts.get(user) || 1) - 1);
    return { ok: true, value: true };
  }

  extendUnlock(moduleId: number, additionalTime: number): Result<boolean> {
    const unlock = this.state.userUnlocks.get(`${this.caller}-${moduleId}`);
    if (!unlock) return { ok: false, value: ERR_USER_NOT_FOUND };
    if (!unlock.status) return { ok: false, value: ERR_INVALID_STATUS };
    if (additionalTime <= 0 || additionalTime > 31536000) return { ok: false, value: ERR_INVALID_EXPIRATION };
    this.state.userUnlocks.set(`${this.caller}-${moduleId}`, { ...unlock, expiration: unlock.expiration + additionalTime });
    return { ok: true, value: true };
  }
}

describe("UnlockManager", () => {
  let contract: UnlockManagerMock;

  beforeEach(() => {
    contract = new UnlockManagerMock();
    contract.reset();
  });

  it("sets token contract successfully", () => {
    contract.caller = "ST1OWNER";
    const result = contract.setTokenContract("ST2NEWTOKEN");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.tokenContract).toBe("ST2NEWTOKEN");
  });

  it("rejects set token contract by non-owner", () => {
    const result = contract.setTokenContract("ST2NEWTOKEN");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets default expiration successfully", () => {
    contract.caller = "ST1OWNER";
    const result = contract.setDefaultExpiration(1000000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.defaultExpiration).toBe(1000000);
  });

  it("rejects invalid default expiration", () => {
    contract.caller = "ST1OWNER";
    const result = contract.setDefaultExpiration(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_EXPIRATION);
  });

  it("pauses contract successfully", () => {
    contract.caller = "ST1OWNER";
    const result = contract.pauseContract();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.paused).toBe(true);
  });

  it("unlocks module successfully", () => {
    const result = contract.unlockModule(1, null);
    expect(result.ok).toBe(true);
    const escrow = contract.getEscrowInfo("ST1USER", 1);
    expect(escrow?.amount).toBe(100);
    expect(escrow?.claimed).toBe(false);
    expect(contract.tokenBalances.get("ST1USER")).toBe(9900);
    expect(contract.tokenBalances.get("ST1CONTRACT")).toBe(100);
  });

  it("rejects unlock when paused", () => {
    contract.state.paused = true;
    const result = contract.unlockModule(1, null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PAUSED);
  });

  it("rejects unlock for non-existent module", () => {
    const result = contract.unlockModule(999, null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MODULE_NOT_FOUND);
  });

  it("rejects unlock if max unlocks exceeded", () => {
    contract.state.maxUserUnlocks = 0;
    const result = contract.unlockModule(1, null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_UNLOCKS_EXCEEDED);
  });

  it("confirms unlock successfully", () => {
    contract.unlockModule(1, null);
    contract.caller = "ST1CREATOR";
    const result = contract.confirmUnlock(1, "ST1USER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const unlock = contract.getUnlockInfo("ST1USER", 1);
    expect(unlock?.status).toBe(true);
    expect(unlock?.expiration).toBe(100 + 2592000);
    const escrow = contract.getEscrowInfo("ST1USER", 1);
    expect(escrow?.claimed).toBe(true);
    expect(contract.tokenBalances.get("ST1CONTRACT")).toBe(0);
    expect(contract.tokenBalances.get("ST1OWNER")).toBe(5);
    expect(contract.tokenBalances.get("ST1CREATOR")).toBe(95);
    expect(contract.getUserUnlockCount("ST1USER")).toBe(1);
  });

  it("rejects confirm by non-creator", () => {
    contract.unlockModule(1, null);
    const result = contract.confirmUnlock(1, "ST1USER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("refunds escrow successfully", () => {
    contract.unlockModule(1, null);
    contract.blockHeight += 86401;
    const result = contract.refundEscrow(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getEscrowInfo("ST1USER", 1)).toBeNull();
    expect(contract.tokenBalances.get("ST1USER")).toBe(10000);
    expect(contract.tokenBalances.get("ST1CONTRACT")).toBe(0);
  });

  it("rejects refund too early", () => {
    contract.unlockModule(1, null);
    const result = contract.refundEscrow(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TIME);
  });

  it("batch unlocks successfully", () => {
    contract.modules.set(2, { price: 200, creator: "ST1CREATOR" });
    const result = contract.batchUnlock([1, 2], [null, null]);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getEscrowInfo("ST1USER", 1)?.amount).toBe(100);
    expect(contract.getEscrowInfo("ST1USER", 2)?.amount).toBe(200);
  });

  it("rejects batch over limit", () => {
    contract.state.maxBatchSize = 1;
    const result = contract.batchUnlock([1, 2], [null, null]);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BATCH_LIMIT);
  });

  it("revokes unlock successfully", () => {
    contract.unlockModule(1, null);
    contract.caller = "ST1CREATOR";
    contract.confirmUnlock(1, "ST1USER");
    const result = contract.revokeUnlock(1, "ST1USER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const unlock = contract.getUnlockInfo("ST1USER", 1);
    expect(unlock?.status).toBe(false);
    expect(contract.getUserUnlockCount("ST1USER")).toBe(0);
  });

  it("extends unlock successfully", () => {
    contract.unlockModule(1, null);
    contract.caller = "ST1CREATOR";
    contract.confirmUnlock(1, "ST1USER");
    contract.caller = "ST1USER";
    const result = contract.extendUnlock(1, 100000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const unlock = contract.getUnlockInfo("ST1USER", 1);
    expect(unlock?.expiration).toBe(100 + 2592000 + 100000);
  });

  it("rejects extend invalid status", () => {
    const result = contract.extendUnlock(1, 100000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_USER_NOT_FOUND);
  });
});