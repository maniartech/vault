import vault from "../src/index"

test("contains a Vault spec for testing built-in defafult vault store", async () => {
  vault.firstName = "John";
  const firstName = await vault.getItem("firstName");
  expect(firstName).to.equal("John");

  vault.lastName = "Doe";
  const lastName = await vault.getItem("lastName");
  expect(lastName).to.equal("Doe");

  const keys = await vault.keys();
  expect(keys).to.equal(["firstName", "lastName"]);

  // Check length
  expect(await vault.length()).to.equal(2);

  const length = await vault.length();
  expect(length).to.equal(2);

  delete vault.firstName;
  expect(await vault.firstName).to.equal(null);

  vault.clear();
  expect(await vault.lastName).to.equal(null);

  expect(await vault.length()).to.equal(0);
  expect(await vault.keys()).to.equal([]);
});


