import Vault from "../vault.js"

describe("Vault", () => {
  it("contains a Vault spec for creating custom vault store", async () => {
    const vault = new Vault("test-store");

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

  it("supports item meta data", async () => {
    const vault = new Vault("meta-store");
    vault.setItem("name", "John", { expires: 1000 });
    const name = await vault.getItem("name");
    expect(name).toBe("John");

    const meta = await vault.getItemMeta("name");
    expect(meta.expires).toEqual(1000);
  });
})


