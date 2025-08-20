import { importData, exportData } from "../dist/backup.js"
import Vault from '../dist/vault.js';

describe('import-export', () => {
    it('exportData', async () => {
        const vault = new Vault("io-store");
        vault.setItem("key1", "key1 Value", { expires: 1000 });
        vault.setItem("key2", "key2 Value", { expires: 2000 });

        const data = await exportData(vault);

        expect(data.key1.value).toBe("key1 Value");
        expect(data.key1.meta.expires).toBe(1000);

        expect(data.key2.value).toBe("key2 Value");
        expect(data.key2.meta.expires).toBe(2000);
    });

    it('importData', async () => {
        const data = {
            key1: {
                value: "key1 Value",
                meta: { expires: 1000 }
            },
            key2: {
                value: "key2 Value",
                meta: { expires: 2000 }
            }
        };

        const vault = new Vault("io-store");
        await importData(vault, data);

        expect(await vault.getItem("key1")).toBe("key1 Value");
        expect(await vault.getItem("key2")).toBe("key2 Value");

        const meta1 = await vault.getItemMeta("key1");
        expect(meta1.expires).toBe(1000);

        const meta2 = await vault.getItemMeta("key2");
        expect(meta2.expires).toBe(2000);
    });
});