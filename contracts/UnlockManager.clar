;; unlock-manager.clar

(define-trait token-trait
  (
    (transfer (principal principal uint) (response bool uint))
    (get-balance (principal) (response uint uint))
  )
)

(define-trait registry-trait
  (
    (get-module-info (uint) (response { price: uint, creator: principal } uint))
  )
)

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-MODULE u101)
(define-constant ERR-INSUFFICIENT-BALANCE u102)
(define-constant ERR-TRANSFER-FAILED u103)
(define-constant ERR-ALREADY-UNLOCKED u104)
(define-constant ERR-EXPIRED u105)
(define-constant ERR-INVALID-AMOUNT u106)
(define-constant ERR-INVALID-TIME u107)
(define-constant ERR-REFUND-FAILED u108)
(define-constant ERR-NO-ESCROW u109)
(define-constant ERR-BATCH-LIMIT u110)
(define-constant ERR-INVALID-RECIPIENT u111)
(define-constant ERR-PAUSED u112)
(define-constant ERR-INVALID-EXPIRATION u113)
(define-constant ERR-MODULE-NOT-FOUND u114)
(define-constant ERR-USER-NOT-FOUND u115)
(define-constant ERR-INVALID-PARAM u116)
(define-constant ERR-ESCROW-ALREADY-CLAIMED u117)
(define-constant ERR-INVALID-STATUS u118)
(define-constant ERR-MAX-UNLOCKS-EXCEEDED u119)
(define-constant ERR-INVALID-BATCH u120)

(define-data-var contract-owner principal tx-sender)
(define-data-var token-contract principal 'SP000000000000000000002Q6VF78.edu-token)
(define-data-var registry-contract principal 'SP000000000000000000002Q6VF78.module-registry)
(define-data-var default-expiration uint u2592000)
(define-data-var platform-fee-rate uint u5)
(define-data-var paused bool false)
(define-data-var max-batch-size uint u10)
(define-data-var max-user-unlocks uint u100)

(define-map user-unlocks
  { user: principal, module-id: uint }
  { expiration: uint, paid: uint, status: bool }
)

(define-map escrows
  { user: principal, module-id: uint }
  { amount: uint, timestamp: uint, claimed: bool }
)

(define-map user-unlock-counts principal uint)

(define-read-only (get-unlock-info (user principal) (module-id uint))
  (map-get? user-unlocks { user: user, module-id: module-id })
)

(define-read-only (get-escrow-info (user principal) (module-id uint))
  (map-get? escrows { user: user, module-id: module-id })
)

(define-read-only (is-unlocked (user principal) (module-id uint))
  (let ((unlock (map-get? user-unlocks { user: user, module-id: module-id })))
    (match unlock
      u (and (get status u) (>= (get expiration u) block-height))
      false
    )
  )
)

(define-read-only (get-user-unlock-count (user principal))
  (default-to u0 (map-get? user-unlock-counts user))
)

(define-private (validate-module (module-id uint))
  (let ((info (unwrap! (contract-call? .module-registry get-module-info module-id) (err ERR-MODULE-NOT-FOUND))))
    (ok info)
  )
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
    (ok true)
    (err ERR-INVALID-AMOUNT)
  )
)

(define-private (validate-expiration (exp uint))
  (if (and (> exp u0) (<= exp u31536000))
    (ok true)
    (err ERR-INVALID-EXPIRATION)
  )
)

(define-private (validate-batch-size (size uint))
  (if (<= size (var-get max-batch-size))
    (ok true)
    (err ERR-BATCH-LIMIT)
  )
)

(define-private (transfer-tokens (from principal) (to principal) (amount uint))
  (contract-call? .edu-token transfer from to amount)
)

(define-public (set-token-contract (new-contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (var-set token-contract new-contract)
    (ok true)
  )
)

(define-public (set-registry-contract (new-contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (var-set registry-contract new-contract)
    (ok true)
  )
)

(define-public (set-default-expiration (new-exp uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-expiration new-exp))
    (var-set default-expiration new-exp)
    (ok true)
  )
)

(define-public (set-platform-fee-rate (new-rate uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= new-rate u10) (err ERR-INVALID-PARAM))
    (var-set platform-fee-rate new-rate)
    (ok true)
  )
)

(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (var-set paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (var-set paused false)
    (ok true)
  )
)

(define-public (set-max-batch-size (new-size uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-size u0) (err ERR-INVALID-PARAM))
    (var-set max-batch-size new-size)
    (ok true)
  )
)

(define-public (set-max-user-unlocks (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max u0) (err ERR-INVALID-PARAM))
    (var-set max-user-unlocks new-max)
    (ok true)
  )
)

(define-public (unlock-module (module-id uint) (custom-exp (optional uint)))
  (let
    (
      (user tx-sender)
      (info (try! (validate-module module-id)))
      (price (get price info))
      (creator (get creator info))
      (exp (default-to (var-get default-expiration) custom-exp))
      (current-count (get-user-unlock-count user))
      (fee (* price (var-get platform-fee-rate) (/ u100)))
      (net-price (- price fee))
    )
    (asserts! (not (var-get paused)) (err ERR-PAUSED))
    (try! (validate-amount price))
    (try! (validate-expiration exp))
    (asserts! (is-none (map-get? user-unlocks { user: user, module-id: module-id })) (err ERR-ALREADY-UNLOCKED))
    (asserts! (< current-count (var-get max-user-unlocks)) (err ERR-MAX-UNLOCKS-EXCEEDED))
    (try! (transfer-tokens user (as-contract tx-sender) price))
    (map-set escrows { user: user, module-id: module-id }
      { amount: price, timestamp: block-height, claimed: false }
    )
    (print { event: "escrow-created", user: user, module: module-id, amount: price })
    (ok true)
  )
)

(define-public (confirm-unlock (module-id uint) (user principal))
  (let
    (
      (escrow (unwrap! (map-get? escrows { user: user, module-id: module-id }) (err ERR-NO-ESCROW)))
      (info (try! (validate-module module-id)))
      (creator (get creator info))
      (price (get amount escrow))
      (fee (* price (var-get platform-fee-rate) (/ u100)))
      (net-price (- price fee))
    )
    (asserts! (is-eq tx-sender creator) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (get claimed escrow)) (err ERR-ESCROW-ALREADY-CLAIMED))
    (try! (as-contract (transfer-tokens tx-sender (var-get contract-owner) fee)))
    (try! (as-contract (transfer-tokens tx-sender creator net-price)))
    (map-set user-unlocks { user: user, module-id: module-id }
      { expiration: (+ block-height (var-get default-expiration)), paid: price, status: true }
    )
    (map-set escrows { user: user, module-id: module-id }
      (merge escrow { claimed: true })
    )
    (map-set user-unlock-counts user (+ (get-user-unlock-count user) u1))
    (print { event: "unlock-confirmed", user: user, module: module-id })
    (ok true)
  )
)

(define-public (refund-escrow (module-id uint))
  (let
    (
      (user tx-sender)
      (escrow (unwrap! (map-get? escrows { user: user, module-id: module-id }) (err ERR-NO-ESCROW)))
      (amount (get amount escrow))
    )
    (asserts! (not (get claimed escrow)) (err ERR-ESCROW-ALREADY-CLAIMED))
    (asserts! (> (- block-height (get timestamp escrow)) u86400) (err ERR-INVALID-TIME))
    (try! (as-contract (transfer-tokens tx-sender user amount)))
    (map-delete escrows { user: user, module-id: module-id })
    (print { event: "escrow-refunded", user: user, module: module-id, amount: amount })
    (ok true)
  )
)

(define-public (batch-unlock (module-ids (list 10 uint)) (custom-exps (list 10 (optional uint))))
  (let
    (
      (size (len module-ids))
    )
    (asserts! (not (var-get paused)) (err ERR-PAUSED))
    (try! (validate-batch-size size))
    (fold batch-unlock-iter (zip module-ids custom-exps) (ok true))
  )
)

(define-private (batch-unlock-iter (pair { id: uint, exp: (optional uint) }) (prev (response bool uint)))
  (match prev
    success (unlock-module (get id pair) (get exp pair))
    error prev
  )
)

(define-public (revoke-unlock (module-id uint) (user principal))
  (let
    (
      (info (try! (validate-module module-id)))
      (unlock (unwrap! (map-get? user-unlocks { user: user, module-id: module-id }) (err ERR-USER-NOT-FOUND)))
    )
    (asserts! (is-eq tx-sender (get creator info)) (err ERR-NOT-AUTHORIZED))
    (map-set user-unlocks { user: user, module-id: module-id }
      (merge unlock { status: false })
    )
    (map-set user-unlock-counts user (- (get-user-unlock-count user) u1))
    (print { event: "unlock-revoked", user: user, module: module-id })
    (ok true)
  )
)

(define-public (extend-unlock (module-id uint) (additional-time uint))
  (let
    (
      (user tx-sender)
      (unlock (unwrap! (map-get? user-unlocks { user: user, module-id: module-id }) (err ERR-USER-NOT-FOUND)))
      (new-exp (+ (get expiration unlock) additional-time))
    )
    (asserts! (get status unlock) (err ERR-INVALID-STATUS))
    (try! (validate-expiration additional-time))
    (map-set user-unlocks { user: user, module-id: module-id }
      (merge unlock { expiration: new-exp })
    )
    (print { event: "unlock-extended", user: user, module: module-id, new-exp: new-exp })
    (ok true)
  )
)