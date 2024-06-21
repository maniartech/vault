import vault from "../index.js";


describe("A suite", () => {
  it("wip tests useful during development", async () => {
    // Run the work-in-progress tests here!
    vault.setItem("key", "value")
    expect(await vault.getItem("key")).toBe("value")
  });
})


