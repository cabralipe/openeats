from decimal import Decimal


ZERO = Decimal('0')


def calculate_recipe_metrics(recipe) -> dict:
    ingredients = list(getattr(recipe, 'ingredients', []).all() if hasattr(getattr(recipe, 'ingredients', None), 'all') else [])

    total_cost = ZERO
    total_gross_weight = ZERO
    total_net_weight = ZERO

    for ingredient in ingredients:
        qty_reference = ingredient.net_weight or ingredient.qty_base or ZERO
        total_cost += (ingredient.unit_cost or ZERO) * qty_reference
        total_gross_weight += ingredient.gross_weight or ZERO
        total_net_weight += ingredient.net_weight or ZERO

    servings_base = Decimal(str(getattr(recipe, 'servings_base', 0) or 0))
    cost_per_portion = (total_cost / servings_base) if servings_base > 0 else ZERO

    return {
        'ingredients_count': len(ingredients),
        'total_cost': round(total_cost, 4),
        'cost_per_portion': round(cost_per_portion, 4),
        'total_gross_weight': round(total_gross_weight, 2),
        'total_net_weight': round(total_net_weight, 2),
    }
