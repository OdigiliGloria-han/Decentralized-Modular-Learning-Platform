import { describe, it, expect, beforeEach } from "vitest";

const ERR_NOT_AUTHORIZED = 401;
const ERR_INSUFFICIENT_BALANCE = 101;
const ERR_INVALID_AMOUNT = 102;
const ERR_INVALID_RECIPIENT = 103;
const ERR_INVALID_SPENDER = 104;
const ERR_INVALID_OWNER = 105;
const ERR_ALREADY_APPROVED = 106;
const ERR_MINT_LIMIT_EXCEEDED = 107;
const ERR_PAUSED = 108;
const ERR_NOT_PAUSED = 109;
const ERR_BLACKLISTED = 110;
const ERR_INVALID_DECIMALS = 111;
const ERR_INVALID_SYMBOL = 112;
const ERR_INVALID_NAME = 113;
const ERR_TRANSFER_FAILED = 114;
const ERR_BURN_FAILED = 115;
const ERR_MINT_FAILED = 116;
const ERR_APPROVAL_FAILED = 117;
const ERR_INVALID_MINTER = 118;
const ERR_MAX_SUPPLY_REACHED = 119;
const ERR_INVALID_PARAM = 120;

interface Result<T> {
  ok: boolean;
  value: T;
}

type Principal = string;

class EduTokenMock {
  state: {
    paused: boolean;
    totalSupply: bigint;
    minter: Principal;
    balances: Map<Principal, bigint>;
    allowances: Map<string, bigint>;
    blacklist: Set<Principal>;
  } = {
    paused: false,
    totalSupply: 0n,
    minter: "ST1OWNER",
    balances: new Map(),
    allowances: new Map(),
    blacklist: new Set(),
  };

  caller: Principal = "ST1OWNER";
  owner: Principal = "ST1OWNER";
  maxSupply: bigint = 1000000000000000n;

  events: Array<{ event: string; [key: string]: any }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      paused: false,
      totalSupply: 0n,
      minter: this.owner,
      balances: new Map(),
      allowances: new Map(),
      blacklist: new Set(),
    };
    this.caller = this.owner;
    this.events = [];
  }

  private isOwner(): boolean {
    return this.caller === this.owner;
  }

  private isMinter(): boolean {
    return this.caller === this.state.minter;
  }

  private isPaused(): boolean {
    return this.state.paused;
  }

  private isBlacklisted(user: Principal): boolean {
    return this.state.blacklist.has(user);
  }

  private validateAmount(amount: bigint): Result<boolean> {
    if (amount > 0n) {
      return { ok: true, value: true };
    }
    return { ok: false, value: false };
  }

  private validatePrincipal(p: Principal): Result<boolean> {
    if (p !== "SP000000000000000000002Q6VF78") {
      return { ok: true, value: true };
    }
    return { ok: false, value: false };
  }

  private validateTransfer(sender: Principal, recipient: Principal, amount: bigint): Result<boolean> {
    if (!this.validatePrincipal(sender).ok || !this.validatePrincipal(recipient).ok || !this.validateAmount(amount).ok) {
      return { ok: false, value: false };
    }
    if (this.isBlacklisted(sender) || this.isBlacklisted(recipient) || this.isPaused()) {
      return { ok: false, value: false };
    }
    return { ok: true, value: true };
  }

  private updateBalance(user: Principal, amount: bigint, increase: boolean): void {
    const current = this.state.balances.get(user) || 0n;
    if (increase) {
      this.state.balances.set(user, current + amount);
    } else {
      this.state.balances.set(user, current - amount);
    }
  }

  getName(): Result<string> {
    return { ok: true, value: "EduToken" };
  }

  getSymbol(): Result<string> {
    return { ok: true, value: "EDU" };
  }

  getDecimals(): Result<number> {
    return { ok: true, value: 6 };
  }

  getBalance(account: Principal): Result<bigint> {
    return { ok: true, value: this.state.balances.get(account) || 0n };
  }

  getTotalSupply(): Result<bigint> {
    return { ok: true, value: this.state.totalSupply };
  }

  getTokenUri(): Result<null> {
    return { ok: true, value: null };
  }

  getAllowance(owner: Principal, spender: Principal): Result<bigint> {
    const key = `${owner}-${spender}`;
    return { ok: true, value: this.state.allowances.get(key) || 0n };
  }

  getMinter(): Result<Principal> {
    return { ok: true, value: this.state.minter };
  }

  isContractPaused(): Result<boolean> {
    return { ok: true, value: this.isPaused() };
  }

  transfer(amount: bigint, sender: Principal, recipient: Principal, memo?: Buffer): Result<boolean> {
    if (this.caller !== sender) {
      return { ok: false, value: false };
    }
    if (!this.validateTransfer(sender, recipient, amount).ok) {
      return { ok: false, value: false };
    }
    const balanceSender = this.getBalance(sender).value;
    if (balanceSender < amount) {
      return { ok: false, value: false };
    }
    this.updateBalance(sender, amount, false);
    this.updateBalance(recipient, amount, true);
    this.events.push({ event: "transfer", from: sender, to: recipient, amount, memo });
    return { ok: true, value: true };
  }

  transferFrom(amount: bigint, owner: Principal, recipient: Principal): Result<boolean> {
    const allowance = this.getAllowance(owner, this.caller).value;
    if (allowance < amount) {
      return { ok: false, value: false };
    }
    if (!this.validateTransfer(owner, recipient, amount).ok) {
      return { ok: false, value: false };
    }
    const balanceOwner = this.getBalance(owner).value;
    if (balanceOwner < amount) {
      return { ok: false, value: false };
    }
    const key = `${owner}-${this.caller}`;
    this.state.allowances.set(key, allowance - amount);
    this.updateBalance(owner, amount, false);
    this.updateBalance(recipient, amount, true);
    this.events.push({ event: "transfer-from", owner, spender: this.caller, to: recipient, amount });
    return { ok: true, value: true };
  }

  approve(spender: Principal, amount: bigint): Result<boolean> {
    if (!this.validatePrincipal(spender).ok || !this.validateAmount(amount).ok || this.isPaused()) {
      return { ok: false, value: false };
    }
    const key = `${this.caller}-${spender}`;
    this.state.allowances.set(key, amount);
    this.events.push({ event: "approve", owner: this.caller, spender, amount });
    return { ok: true, value: true };
  }

  increaseAllowance(spender: Principal, amount: bigint): Result<boolean> {
    const current = this.getAllowance(this.caller, spender).value;
    return this.approve(spender, current + amount);
  }

  decreaseAllowance(spender: Principal, amount: bigint): Result<boolean> {
    const current = this.getAllowance(this.caller, spender).value;
    if (current < amount) {
      return { ok: false, value: false };
    }
    return this.approve(spender, current - amount);
  }

  mint(amount: bigint, recipient: Principal): Result<boolean> {
    if (!this.isMinter()) {
      return { ok: false, value: false };
    }
    if (!this.validateAmount(amount).ok || !this.validatePrincipal(recipient).ok || this.isBlacklisted(recipient)) {
      return { ok: false, value: false };
    }
    const newSupply = this.state.totalSupply + amount;
    if (newSupply > this.maxSupply) {
      return { ok: false, value: false };
    }
    this.updateBalance(recipient, amount, true);
    this.state.totalSupply = newSupply;
    this.events.push({ event: "mint", to: recipient, amount });
    return { ok: true, value: true };
  }

  burn(amount: bigint): Result<boolean> {
    if (!this.validateAmount(amount).ok || this.isPaused()) {
      return { ok: false, value: false };
    }
    const balance = this.getBalance(this.caller).value;
    if (balance < amount) {
      return { ok: false, value: false };
    }
    this.updateBalance(this.caller, amount, false);
    this.state.totalSupply -= amount;
    this.events.push({ event: "burn", from: this.caller, amount });
    return { ok: true, value: true };
  }

  burnFrom(amount: bigint, owner: Principal): Result<boolean> {
    const transferRes = this.transferFrom(amount, owner, this.caller);
    if (!transferRes.ok) {
      return { ok: false, value: false };
    }
    return this.burn(amount);
  }

  setMinter(newMinter: Principal): Result<boolean> {
    if (!this.isOwner() && !this.isMinter()) {
      return { ok: false, value: false };
    }
    if (!this.validatePrincipal(newMinter).ok) {
      return { ok: false, value: false };
    }
    this.state.minter = newMinter;
    this.events.push({ event: "set-minter", newMinter });
    return { ok: true, value: true };
  }

  pauseContract(): Result<boolean> {
    if (!this.isOwner() || this.isPaused()) {
      return { ok: false, value: false };
    }
    this.state.paused = true;
    this.events.push({ event: "pause" });
    return { ok: true, value: true };
  }

  unpauseContract(): Result<boolean> {
    if (!this.isOwner() || !this.isPaused()) {
      return { ok: false, value: false };
    }
    this.state.paused = false;
    this.events.push({ event: "unpause" });
    return { ok: true, value: true };
  }

  addToBlacklist(user: Principal): Result<boolean> {
    if (!this.isOwner() || !this.validatePrincipal(user).ok) {
      return { ok: false, value: false };
    }
    this.state.blacklist.add(user);
    this.events.push({ event: "blacklist-add", user });
    return { ok: true, value: true };
  }

  removeFromBlacklist(user: Principal): Result<boolean> {
    if (!this.isOwner()) {
      return { ok: false, value: false };
    }
    this.state.blacklist.delete(user);
    this.events.push({ event: "blacklist-remove", user });
    return { ok: true, value: true };
  }
}

describe("EduToken", () => {
  let contract: EduTokenMock;

  beforeEach(() => {
    contract = new EduTokenMock();
    contract.reset();
  });

  it("gets name correctly", () => {
    const result = contract.getName();
    expect(result.ok).toBe(true);
    expect(result.value).toBe("EduToken");
  });

  it("gets symbol correctly", () => {
    const result = contract.getSymbol();
    expect(result.ok).toBe(true);
    expect(result.value).toBe("EDU");
  });

  it("gets decimals correctly", () => {
    const result = contract.getDecimals();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(6);
  });

  it("gets initial balance zero", () => {
    const result = contract.getBalance("ST1USER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0n);
  });

  it("gets initial total supply zero", () => {
    const result = contract.getTotalSupply();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0n);
  });

  it("gets token uri none", () => {
    const result = contract.getTokenUri();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(null);
  });

  it("gets initial allowance zero", () => {
    const result = contract.getAllowance("ST1USER", "ST2SPENDER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0n);
  });

  it("gets initial minter", () => {
    const result = contract.getMinter();
    expect(result.ok).toBe(true);
    expect(result.value).toBe("ST1OWNER");
  });

  it("checks initial paused false", () => {
    const result = contract.isContractPaused();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(false);
  });

  it("mints successfully as minter", () => {
    const result = contract.mint(100n, "ST1USER");
    expect(result.ok).toBe(true);
    expect(contract.getBalance("ST1USER").value).toBe(100n);
    expect(contract.getTotalSupply().value).toBe(100n);
  });

  it("rejects mint as non-minter", () => {
    contract.caller = "ST2FAKE";
    const result = contract.mint(100n, "ST1USER");
    expect(result.ok).toBe(false);
  });

  it("rejects mint invalid amount", () => {
    const result = contract.mint(0n, "ST1USER");
    expect(result.ok).toBe(false);
  });

  it("rejects mint to invalid principal", () => {
    const result = contract.mint(100n, "SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
  });

  it("rejects mint to blacklisted", () => {
    contract.addToBlacklist("ST1USER");
    const result = contract.mint(100n, "ST1USER");
    expect(result.ok).toBe(false);
  });

  it("rejects mint exceeding max supply", () => {
    contract.maxSupply = 100n;
    contract.mint(100n, "ST1USER");
    const result = contract.mint(1n, "ST1USER");
    expect(result.ok).toBe(false);
  });

  it("transfers successfully", () => {
    contract.mint(100n, "ST1SENDER");
    contract.caller = "ST1SENDER";
    const result = contract.transfer(50n, "ST1SENDER", "ST2RECIPIENT");
    expect(result.ok).toBe(true);
    expect(contract.getBalance("ST1SENDER").value).toBe(50n);
    expect(contract.getBalance("ST2RECIPIENT").value).toBe(50n);
  });

  it("rejects transfer unauthorized", () => {
    contract.mint(100n, "ST1SENDER");
    contract.caller = "ST2FAKE";
    const result = contract.transfer(50n, "ST1SENDER", "ST2RECIPIENT");
    expect(result.ok).toBe(false);
  });

  it("rejects transfer insufficient balance", () => {
    contract.mint(100n, "ST1SENDER");
    contract.caller = "ST1SENDER";
    const result = contract.transfer(101n, "ST1SENDER", "ST2RECIPIENT");
    expect(result.ok).toBe(false);
  });

  it("rejects transfer paused", () => {
    contract.mint(100n, "ST1SENDER");
    contract.pauseContract();
    contract.caller = "ST1SENDER";
    const result = contract.transfer(50n, "ST1SENDER", "ST2RECIPIENT");
    expect(result.ok).toBe(false);
  });

  it("rejects transfer blacklisted sender", () => {
    contract.mint(100n, "ST1SENDER");
    contract.addToBlacklist("ST1SENDER");
    contract.caller = "ST1SENDER";
    const result = contract.transfer(50n, "ST1SENDER", "ST2RECIPIENT");
    expect(result.ok).toBe(false);
  });

  it("rejects transfer blacklisted recipient", () => {
    contract.mint(100n, "ST1SENDER");
    contract.addToBlacklist("ST2RECIPIENT");
    contract.caller = "ST1SENDER";
    const result = contract.transfer(50n, "ST1SENDER", "ST2RECIPIENT");
    expect(result.ok).toBe(false);
  });

  it("approves successfully", () => {
    const result = contract.approve("ST2SPENDER", 100n);
    expect(result.ok).toBe(true);
    expect(contract.getAllowance("ST1OWNER", "ST2SPENDER").value).toBe(100n);
  });

  it("rejects approve paused", () => {
    contract.pauseContract();
    const result = contract.approve("ST2SPENDER", 100n);
    expect(result.ok).toBe(false);
  });

  it("increases allowance successfully", () => {
    contract.approve("ST2SPENDER", 100n);
    const result = contract.increaseAllowance("ST2SPENDER", 50n);
    expect(result.ok).toBe(true);
    expect(contract.getAllowance("ST1OWNER", "ST2SPENDER").value).toBe(150n);
  });

  it("decreases allowance successfully", () => {
    contract.approve("ST2SPENDER", 100n);
    const result = contract.decreaseAllowance("ST2SPENDER", 50n);
    expect(result.ok).toBe(true);
    expect(contract.getAllowance("ST1OWNER", "ST2SPENDER").value).toBe(50n);
  });

  it("rejects decrease allowance below zero", () => {
    contract.approve("ST2SPENDER", 100n);
    const result = contract.decreaseAllowance("ST2SPENDER", 101n);
    expect(result.ok).toBe(false);
  });

  it("transfers from successfully", () => {
    contract.mint(100n, "ST1OWNER");
    contract.caller = "ST1OWNER";
    contract.approve("ST2SPENDER", 50n);
    contract.caller = "ST2SPENDER";
    const result = contract.transferFrom(50n, "ST1OWNER", "ST3RECIPIENT");
    expect(result.ok).toBe(true);
    expect(contract.getBalance("ST1OWNER").value).toBe(50n);
    expect(contract.getBalance("ST3RECIPIENT").value).toBe(50n);
    expect(contract.getAllowance("ST1OWNER", "ST2SPENDER").value).toBe(0n);
  });

  it("rejects transfer from insufficient allowance", () => {
    contract.mint(100n, "ST1OWNER");
    contract.caller = "ST1OWNER";
    contract.approve("ST2SPENDER", 50n);
    contract.caller = "ST2SPENDER";
    const result = contract.transferFrom(51n, "ST1OWNER", "ST3RECIPIENT");
    expect(result.ok).toBe(false);
  });

  it("burns successfully", () => {
    contract.mint(100n, "ST1USER");
    contract.caller = "ST1USER";
    const result = contract.burn(50n);
    expect(result.ok).toBe(true);
    expect(contract.getBalance("ST1USER").value).toBe(50n);
    expect(contract.getTotalSupply().value).toBe(50n);
  });

  it("rejects burn insufficient balance", () => {
    contract.mint(100n, "ST1USER");
    contract.caller = "ST1USER";
    const result = contract.burn(101n);
    expect(result.ok).toBe(false);
  });

  it("rejects burn paused", () => {
    contract.mint(100n, "ST1USER");
    contract.pauseContract();
    contract.caller = "ST1USER";
    const result = contract.burn(50n);
    expect(result.ok).toBe(false);
  });

  it("burns from successfully", () => {
    contract.mint(100n, "ST1OWNER");
    contract.caller = "ST1OWNER";
    contract.approve("ST2SPENDER", 50n);
    contract.caller = "ST2SPENDER";
    const result = contract.burnFrom(50n, "ST1OWNER");
    expect(result.ok).toBe(true);
    expect(contract.getBalance("ST1OWNER").value).toBe(50n);
    expect(contract.getTotalSupply().value).toBe(50n);
  });

  it("sets minter successfully as owner", () => {
    const result = contract.setMinter("ST3NEWMINT");
    expect(result.ok).toBe(true);
    expect(contract.getMinter().value).toBe("ST3NEWMINT");
  });

  it("sets minter successfully as minter", () => {
    contract.caller = contract.state.minter;
    const result = contract.setMinter("ST3NEWMINT");
    expect(result.ok).toBe(true);
  });

  it("rejects set minter unauthorized", () => {
    contract.caller = "ST2FAKE";
    const result = contract.setMinter("ST3NEWMINT");
    expect(result.ok).toBe(false);
  });

  it("pauses contract successfully", () => {
    const result = contract.pauseContract();
    expect(result.ok).toBe(true);
    expect(contract.isContractPaused().value).toBe(true);
  });

  it("rejects pause unauthorized", () => {
    contract.caller = "ST2FAKE";
    const result = contract.pauseContract();
    expect(result.ok).toBe(false);
  });

  it("rejects pause when already paused", () => {
    contract.pauseContract();
    const result = contract.pauseContract();
    expect(result.ok).toBe(false);
  });

  it("unpauses contract successfully", () => {
    contract.pauseContract();
    const result = contract.unpauseContract();
    expect(result.ok).toBe(true);
    expect(contract.isContractPaused().value).toBe(false);
  });

  it("rejects unpause unauthorized", () => {
    contract.pauseContract();
    contract.caller = "ST2FAKE";
    const result = contract.unpauseContract();
    expect(result.ok).toBe(false);
  });

  it("rejects unpause when not paused", () => {
    const result = contract.unpauseContract();
    expect(result.ok).toBe(false);
  });

  it("adds to blacklist successfully", () => {
    const result = contract.addToBlacklist("ST4BAD");
    expect(result.ok).toBe(true);
    expect(contract.isBlacklisted("ST4BAD")).toBe(true);
  });

  it("rejects add to blacklist unauthorized", () => {
    contract.caller = "ST2FAKE";
    const result = contract.addToBlacklist("ST4BAD");
    expect(result.ok).toBe(false);
  });

  it("removes from blacklist successfully", () => {
    contract.addToBlacklist("ST4BAD");
    const result = contract.removeFromBlacklist("ST4BAD");
    expect(result.ok).toBe(true);
    expect(contract.isBlacklisted("ST4BAD")).toBe(false);
  });

  it("rejects remove from blacklist unauthorized", () => {
    contract.addToBlacklist("ST4BAD");
    contract.caller = "ST2FAKE";
    const result = contract.removeFromBlacklist("ST4BAD");
    expect(result.ok).toBe(false);
  });

  it("emits events on mint", () => {
    contract.mint(100n, "ST1USER");
    expect(contract.events).toEqual([{ event: "mint", to: "ST1USER", amount: 100n }]);
  });

  it("emits events on transfer", () => {
    contract.mint(100n, "ST1SENDER");
    contract.caller = "ST1SENDER";
    contract.transfer(50n, "ST1SENDER", "ST2RECIPIENT");
    expect(contract.events[1]).toEqual({ event: "transfer", from: "ST1SENDER", to: "ST2RECIPIENT", amount: 50n, memo: undefined });
  });

  it("emits events on approve", () => {
    contract.approve("ST2SPENDER", 100n);
    expect(contract.events).toEqual([{ event: "approve", owner: "ST1OWNER", spender: "ST2SPENDER", amount: 100n }]);
  });

  it("emits events on burn", () => {
    contract.mint(100n, "ST1USER");
    contract.caller = "ST1USER";
    contract.burn(50n);
    expect(contract.events[1]).toEqual({ event: "burn", from: "ST1USER", amount: 50n });
  });

  it("emits events on set minter", () => {
    contract.setMinter("ST3NEWMINT");
    expect(contract.events).toEqual([{ event: "set-minter", newMinter: "ST3NEWMINT" }]);
  });

  it("emits events on pause", () => {
    contract.pauseContract();
    expect(contract.events).toEqual([{ event: "pause" }]);
  });

  it("emits events on unpause", () => {
    contract.pauseContract();
    contract.unpauseContract();
    expect(contract.events[1]).toEqual({ event: "unpause" });
  });

  it("emits events on blacklist add", () => {
    contract.addToBlacklist("ST4BAD");
    expect(contract.events).toEqual([{ event: "blacklist-add", user: "ST4BAD" }]);
  });

  it("emits events on blacklist remove", () => {
    contract.addToBlacklist("ST4BAD");
    contract.removeFromBlacklist("ST4BAD");
    expect(contract.events[1]).toEqual({ event: "blacklist-remove", user: "ST4BAD" });
  });
});