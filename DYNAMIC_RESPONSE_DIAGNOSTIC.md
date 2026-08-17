# Diagnóstico de respuesta dinámica

Fecha: 2026-08-17

## Causa de los 537,83 min originales

F_UF estaba gobernado por el lazo molino → PSD → sump → bomba → ciclón → UF → molino. La constante efectiva original fue 90,87 min, frente a `tauHold=2 min`, `tauCyclone=0,15 min` y residencia del sump≈18,49 min. El split de sólidos al UF≈70,08 % amplificaba la residencia mediante recirculación.

Además, F_UF y CL representaban el mismo flujo en el caso base, pero F_UF tenía tolerancia de 0,5 t/h y CL de 1 punto porcentual; esa diferencia hacía que F_UF fuese la última variable.

## Sensibilidad antes del cambio energético

| Escenario | T95 F_UF min | T99 F_UF min |
|---|---:|---:|
| tauHold 0,5× | 258,17 | 391,17 |
| Base | 273,83 | 413,50 |
| tauHold 2× | 122,17 | 199,17 |
| tauCyclone 0,5× / 2× | 273,83 | 413,50 |
| sump 0,5× | 138,00 | 214,17 |
| sump 2× | 543,00 | >600 |
| Kp 0,5× / 2× | 265,17 / 274,83 | 407,50 / 415,17 |
| Ki 0,5× / 2× | 271,83 / 274,83 | 409,67 / 415,17 |
| rotura 0,8× / 1,2× | 221,00 / 218,50 | 276,67 / 329,50 |

El volumen del sump domina; Kp/Ki tienen efecto menor. `tauCyclone` no participa actualmente en las ecuaciones dinámicas y por eso no produce ningún efecto. No se cambiaron constantes.

## Tolerancia original de F_UF

Entrada permanente original: ±5 % 265,67 min; ±2 % 345,50; ±1 % 405,33; ±0,5 % 465,00; ±0,1 % no alcanzada en 600 min. La banda de derivada `|dFUF/dt|≤0,08 t/h/min` se alcanza a 310,67 min.

## Convergencia operacional y numérica

Se propone, aún sin sustituir criterios oficiales, `OPERATIONALLY_STABLE` con ventana de 10 min y bandas: P80 OF ±2 %, CL/FUF ±5 %, nivel ±2 puntos y densidad ±1 %. El motor anterior alcanzaba esta condición a 266 min.

Tras la corrección energética, sin cambiar tau ni PI: T63/T90/T95/T99 de F_UF = 34,33/109,00/125,83/151,17 min; tau efectiva≈39,13 min; estabilidad operacional≈168,83 min. La mejora es consecuencia de una PSD/recirculación estacionaria distinta, no de ajuste destinado a conseguir PASS.

La convergencia matemática estricta permanece separada del estado operacional. Los criterios definitivos requieren datos de planta.

## Pendientes

- Implementar estados persistentes `OPERATIONALLY_STABLE` y `NUMERICALLY_CONVERGED` solo después de acordar bandas con operación.
- Resolver o retirar `tauCyclone`, actualmente sin efecto dinámico.
- Repetir sensibilidad dinámica completa del modelo energético nuevo; se conserva como pendiente por cierre de cuota.
