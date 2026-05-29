import { singleton } from 'tsyringe'
import { FEDERATION_DIRECTIVES, FEDERATION_SCALARS, type FederationDirectiveSpec } from './directives'

@singleton()
export class FederationRegistry {
    private readonly directivesByName = new Map<string, FederationDirectiveSpec>(
        FEDERATION_DIRECTIVES.map(d => [d.name, d])
    )
    private readonly scalars = new Set<string>(FEDERATION_SCALARS)

    isFederationDirective(name: string): boolean {
        return this.directivesByName.has(name)
    }

    isFederationScalar(name: string): boolean {
        return this.scalars.has(name)
    }

    getDirective(name: string): FederationDirectiveSpec | undefined {
        return this.directivesByName.get(name)
    }

    directives(): readonly FederationDirectiveSpec[] {
        return FEDERATION_DIRECTIVES
    }

    directiveWithFieldSelection(name: string): FederationDirectiveSpec | undefined {
        const spec = this.directivesByName.get(name)
        if (!spec || !spec.fieldSelectionArg) return undefined
        return spec
    }
}
