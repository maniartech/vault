import vault from '../dist/index.js';

describe("A suite", () => {
  it("contains a spec with an expectation", async () => {
    vault.name = "John Doe2";
    const value = await vault.getItem("name")
    expect(value).toBe("John Doe2");

    delete vault["name"];
    expect(await vault.name).toBe(null);
  });
})