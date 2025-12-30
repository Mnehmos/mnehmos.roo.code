import { historyItemSchema } from "../history.js"

describe("historyItemSchema", () => {
	// Base valid object with all required fields
	const validBaseItem = {
		id: "task-123",
		number: 1,
		ts: 1703856000000,
		task: "Test task",
		tokensIn: 100,
		tokensOut: 200,
		totalCost: 0.01,
	}

	describe("resumable field", () => {
		it("should accept resumable: true", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				resumable: true,
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.resumable).toBe(true)
			}
		})

		it("should accept resumable: false", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				resumable: false,
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.resumable).toBe(false)
			}
		})

		it("should accept omitted resumable (optional)", () => {
			const result = historyItemSchema.safeParse(validBaseItem)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.resumable).toBeUndefined()
			}
		})

		it("should reject non-boolean resumable", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				resumable: "yes",
			})
			expect(result.success).toBe(false)
		})
	})

	describe("resumedFromId field", () => {
		it("should accept valid string resumedFromId", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				resumedFromId: "original-task-456",
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.resumedFromId).toBe("original-task-456")
			}
		})

		it("should accept omitted resumedFromId (optional)", () => {
			const result = historyItemSchema.safeParse(validBaseItem)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.resumedFromId).toBeUndefined()
			}
		})

		it("should reject non-string resumedFromId", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				resumedFromId: 123,
			})
			expect(result.success).toBe(false)
		})
	})

	describe("resumeCount field", () => {
		it("should accept resumeCount: 0", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				resumeCount: 0,
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.resumeCount).toBe(0)
			}
		})

		it("should accept resumeCount: 1", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				resumeCount: 1,
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.resumeCount).toBe(1)
			}
		})

		it("should accept resumeCount: 5", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				resumeCount: 5,
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.resumeCount).toBe(5)
			}
		})

		it("should accept omitted resumeCount (optional)", () => {
			const result = historyItemSchema.safeParse(validBaseItem)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.resumeCount).toBeUndefined()
			}
		})

		it("should reject non-number resumeCount", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				resumeCount: "three",
			})
			expect(result.success).toBe(false)
		})
	})

	describe("lastResumedAt field", () => {
		it("should accept valid timestamp for lastResumedAt", () => {
			const timestamp = 1703856000000
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				lastResumedAt: timestamp,
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.lastResumedAt).toBe(timestamp)
			}
		})

		it("should accept omitted lastResumedAt (optional)", () => {
			const result = historyItemSchema.safeParse(validBaseItem)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.lastResumedAt).toBeUndefined()
			}
		})

		it("should reject non-number lastResumedAt", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				lastResumedAt: "2024-01-01",
			})
			expect(result.success).toBe(false)
		})
	})

	describe("combined resume fields", () => {
		it("should accept all resume fields together", () => {
			const result = historyItemSchema.safeParse({
				...validBaseItem,
				resumable: true,
				resumedFromId: "original-task-789",
				resumeCount: 2,
				lastResumedAt: 1703856000000,
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.resumable).toBe(true)
				expect(result.data.resumedFromId).toBe("original-task-789")
				expect(result.data.resumeCount).toBe(2)
				expect(result.data.lastResumedAt).toBe(1703856000000)
			}
		})
	})
})
