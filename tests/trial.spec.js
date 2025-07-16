import vault from "../index.js";

describe("A suite", () => {
  beforeEach(async () => {
    // Clear vault before each test
    await vault.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await vault.clear();
  });

  it("wip tests useful during development", async () => {
    // Run the work-in-progress tests here!
    vault.setItem("key", "value")
    expect(await vault.getItem("key")).toBe("value")
  });
})


