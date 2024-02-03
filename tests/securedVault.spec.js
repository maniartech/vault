import SecuredVault from "../dist/secured-vault.js"

describe("SecuredVault", () => {
  it("contains a SecuredVault specs using basic encConfig", async () => {
    const vault = new SecuredVault("secured-store-basic", {
        "password": "password",
        "salt": "salt"
      });

    await vault.setItem("firstName", "John");
    const firstName = await vault.getItem("firstName");
    expect(firstName).toBe("John");

    await vault.setItem("lastName", "Doe");
    const lastName = await vault.getItem("lastName");
    expect(lastName).toBe("Doe");

    const keys = await vault.keys();
    expect(keys).toEqual(["firstName", "lastName"]);

    // Check length
    expect(await vault.length()).toBe(2);

    await delete vault.firstName;
    expect(await vault.firstName).toBe(null);

    await vault.clear();
    expect(await vault.lastName).toBe(null);

    expect(await vault.length()).toBe(0);
    expect(await vault.keys()).toEqual([]);
  });

  it("contains a SecuredVault specs using function based encConfig", async () => {
    const vault = new SecuredVault("secured-store-function", () => {
      return {
        "password": "password",
        "salt": "salt"
      }
    });

    await vault.setItem("firstName", "John");
    const firstName = await vault.getItem("firstName");
    expect(firstName).toBe("John");

    await vault.setItem("lastName", "Doe");
    const lastName = await vault.getItem("lastName");
    expect(lastName).toBe("Doe");

    const keys = await vault.keys();
    expect(keys).toEqual(["firstName", "lastName"]);

    // Check length
    expect(await vault.length()).toBe(2);

    await delete vault.firstName;
    expect(await vault.firstName).toBe(null);

    await vault.clear();
    expect(await vault.lastName).toBe(null);

    expect(await vault.length()).toBe(0);
    expect(await vault.keys()).toEqual([]);
  });

  it("contains a SecuredVault specs using proxy based encConfig", async () => {
    const vault = new SecuredVault("secured-store-proxy", () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            "password": "password",
            "salt": "salt"
          });
        }, 100);
      });
    });

    await vault.setItem("firstName", "John");
    const firstName = await vault.getItem("firstName");
    expect(firstName).toBe("John");

    await vault.setItem("lastName", "Doe");
    const lastName = await vault.getItem("lastName");
    expect(lastName).toBe("Doe");

    const keys = await vault.keys();
    expect(keys).toEqual(["firstName", "lastName"]);

    // Check length
    expect(await vault.length()).toBe(2);

    await delete vault.firstName;
    expect(await vault.firstName).toBe(null);

    await vault.clear();
    expect(await vault.lastName).toBe(null);

    expect(await vault.length()).toBe(0);
    expect(await vault.keys()).toEqual([]);
  });
})


