import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';
import type { ZxcvbnCheckerFactoryInterface, ZxcvbnChecker } from './ZxcvbnCheckerTypes.js';

export class ZxcvbnCheckerFactory implements ZxcvbnCheckerFactoryInterface {
    public create(): ZxcvbnChecker {
        return new ZxcvbnFactory({
            translations: zxcvbnEnPackage.translations,
            graphs: zxcvbnCommonPackage.adjacencyGraphs,
            dictionary: {
                ...zxcvbnCommonPackage.dictionary,
                ...zxcvbnEnPackage.dictionary,
            },
        });
    }
}
