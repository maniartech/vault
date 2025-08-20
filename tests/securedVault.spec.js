import EncryptedVault from "../encrypted-vault.js"

describe("EncryptedVault (Legacy SecuredVault Tests)", () => {
  it("contains an EncryptedVault specs using basic encConfig", async () => {
    const vault = new EncryptedVault({
        "password": "password",
        "salt": "salt"
      }, {
        "storageName": "secured-store-basic"
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

  it("contains an EncryptedVault specs using function based encConfig", async () => {
    const vault = new EncryptedVault(() => {
      return {
        "password": "password",
        "salt": "salt"
      }
    }, {
      "storageName": "secured-store-function"
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

  it("contains an EncryptedVault specs using proxy based encConfig", async () => {
    const vault = new EncryptedVault(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            "password": "password",
            "salt": "salt"
          });
        }, 100);
      });
    }, {
      "storageName": "secured-store-promise"
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


