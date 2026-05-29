import { singleton } from 'tsyringe'
import {
    FEDERATION_DIRECTIVES,
    FEDERATION_SCALARS,
    STANDARD_DIRECTIVES,
    type FederationDirectiveSpec
} from './directives'

@singleton()
export class FederationRegistry {
    private readonly federationByName = new Map<string, FederationDirectiveSpec>(
        FEDERATION_DIRECTIVES.map(d => [d.name, d])
    )
    private readonly standardByName = new Map<string, FederationDirectiveSpec>(
        STANDARD_DIRECTIVES.map(d => [d.name, d])
    )
    private readonly scalars = new Set<string>(FEDERATION_SCALARS)

    isFederationDirective(name: string): boolean {
        return this.federationByName.has(name)
    }

    isStandardDirective(name: string): boolean {
        return this.standardByName.has(name)
    }

    isBuiltinDirective(name: string): boolean {
        return this.isFederationDirective(name) || this.isStandardDirective(name)
    }

    isFederationScalar(name: string): boolean {
        return this.scalars.has(name)
    }

    getDirective(name: string): FederationDirectiveSpec | undefined {
        return this.federationByName.get(name) ?? this.standardByName.get(name)
    }

    directives(): readonly FederationDirectiveSpec[] {
        return [...STANDARD_DIRECTIVES, ...FEDERATION_DIRECTIVES]
    }

    directiveWithFieldSelection(name: string): FederationDirectiveSpec | undefined {
        const spec = this.getDirective(name)
        if (!spec || !spec.fieldSelectionArg) return undefined
        return spec
    }
}
