import { importData, exportData } from '../dist/import-export.js';

describe('import-export', () => {
    test('exportData', async () => {
        const mockVault = {
            getAllKeys: jest.fn().mockResolvedValue(['key1', 'key2']),
            get: jest.fn().mockImplementation((key) => Promise.resolve(key + 'Value')),
            getMetadata: jest.fn().mockImplementation((key) => Promise.resolve(key + 'Metadata')),
        };

        const jsonString = await exportData(mockVault);

        expect(jsonString).toEqual(JSON.stringify([
            { key: 'key1', value: 'key1Value', metadata: 'key1Metadata' },
            { key: 'key2', value: 'key2Value', metadata: 'key2Metadata' },
        ]));
    });

    test('importData', async () => {
        const mockVault = {
            set: jest.fn().mockResolvedValue(undefined),
            setMetadata: jest.fn().mockResolvedValue(undefined),
        };

        const jsonString = JSON.stringify([
            { key: 'key1', value: 'key1Value', metadata: 'key1Metadata' },
            { key: 'key2', value: 'key2Value', metadata: 'key2Metadata' },
        ]);

        await importData(mockVault, jsonString);

        expect(mockVault.set).toHaveBeenCalledWith('key1', 'key1Value');
        expect(mockVault.set).toHaveBeenCalledWith('key2', 'key2Value');
        expect(mockVault.setMetadata).toHaveBeenCalledWith('key1', 'key1Metadata');
        expect(mockVault.setMetadata).toHaveBeenCalledWith('key2', 'key2Metadata');
    });
});