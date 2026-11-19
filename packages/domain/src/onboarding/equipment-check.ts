import { availableEquipment, type EquipmentType } from '../workout/substitutes';

// PRD §6.2 AC: a programme requiring equipment the user lacks shows a warning.

/**
 * The programme's required equipment the user does not have, in the programme's order.
 * D42: bodyweight always counts and no item implies another (`gym` is not a pull-up bar).
 * A user who recorded no equipment has not said what they lack, so nothing is reported.
 */
export function missingEquipment(
  userEquipment: readonly EquipmentType[],
  required: readonly EquipmentType[],
): EquipmentType[] {
  const available = availableEquipment(userEquipment, required);
  return required.filter((item) => !available.has(item));
}
