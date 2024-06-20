import vault from "../"

describe("Vault", () => {
  it("contains a Vault spec for testing built-in defafult vault store", async () => {
    vault.firstName = "John";
    const firstName = await vault.getItem("firstName");
    expect(firstName).toBe("John");

    vault.lastName = "Doe";
    const lastName = await vault.getItem("lastName");
    expect(lastName).toBe("Doe");

    const keys = await vault.keys();
    expect(keys).toEqual(["firstName", "lastName"]);

    // Check length
    expect(await vault.length()).toBe(2);

    const length = await vault.length();
    expect(length).toBe(2);

    delete vault.firstName;
    expect(await vault.firstName).toBe(null);

    vault.clear();
    expect(await vault.lastName).toBe(null);

    expect(await vault.length()).toBe(0);
    expect(await vault.keys()).toEqual([]);
  });
})


