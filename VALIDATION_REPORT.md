# MK ProcessSim — Informe de auditoría y validación numérica

Fecha: 2026-08-16

## Resultado honesto

La suite contiene **200 verificaciones: 197 PASS y 3 FAIL**. Los fallos se conservan deliberadamente:

- el arranque alcanza y mantiene las tolerancias recién a 537,7 min, superando el límite de aceptación justificado de 360 min;
- los escenarios de 150 y 200 t/h no satisfacen el criterio de convergencia de `solveSteadyState()` dentro de su horizonte de 1800 min.

Por tanto, este informe **no** declara al simulador globalmente validado. `TEST_RESULTS.json` contiene valores, tolerancias y fallos sin ocultarlos.

## Hallazgos de la auditoría

### CRÍTICO

- El antiguo `test_speed_independence` repetía literalmente `advance(..., 30*60, 1)` para 1×, 5×, 10× y 20×. El multiplicador solo aparecía en el nombre del test; era un falso positivo.
- El antiguo test de arranque esperaba 1200 min y solo comparaba el estado final. No medía T63/T90/T95/T99 ni revelaba que la aceptación a 360 min falla.

### MAYOR

- Los tests de deriva, `dt`, perturbaciones, rotura, ciclón, sump y controles eran parciales o inexistentes.
- Los escenarios de capacidad alta no convergen con el solver estacionario actual, aunque permanecen finitos.
- Varias perturbaciones tardan una fracción importante del horizonte de 240 min en completar el 95 % del cambio final observado. Esto es una predicción del modelo actual, no una constante física validada.

### MENOR

- Una PSD dispersa podía producir `P80 = 25 400,00000000001 µm` por redondeo. Se limitó explícitamente el resultado a la malla granulométrica.

### CORRECTO

- Los balances algebraicos de sólidos y agua cierran.
- La rotura transfiere masa entre clases sin crear ni destruir sólidos.
- La partición a underflow es acotada y monótona con tamaño para la formulación implementada.

## Reloj de simulación

Se implementó y probó la separación:

`simDeltaSec = wallDeltaSec · speedMultiplier`

| Velocidad | Wall time para 30 min simulados |
|---:|---:|
| 1× | 1800 s |
| 5× | 360 s |
| 10× | 180 s |
| 20× | 90 s |

El solver usa `solverMaxDtSec = 1 s`. Se compararon P80 OF, P80 molino, CL, nivel de sump, densidad de ciclón, FUF, FOF, inventario y potencia. El máximo error relativo entre velocidades fue `8,24·10⁻13`. A 30/60/120 FPS, el máximo error relativo fue `7,57·10⁻13`. Render y velocidad no modifican la física al mismo tiempo simulado.

## Arranque y tiempos de respuesta

Los tiempos se calculan respecto a `(y(t)-y0)/(yss-y0)`, sin asumir monotonicidad. Overshoot, undershoot, máximo, mínimo y sus tiempos están en `TEST_RESULTS.json`.

| Variable | T63 min | T90 min | T95 min | T99 min |
|---|---:|---:|---:|---:|
| P80 overflow | 4,50 | 5,67 | 6,00 | 6,33 |
| Carga circulante | 89,83 | 212,83 | 273,83 | 413,50 |
| Nivel sump | 0,17 | 0,17 | 0,17 | 0,17 |
| Densidad ciclón | 52,00 | 150,83 | 208,50 | 346,00 |
| Inventario molino | 0,67 | 0,83 | 1,00 | 1,00 |

El P80 OF presenta overshoot de 15,43 µm respecto del estado final y llega a un mínimo de 87,01 µm a 22,83 min. El nivel del sump oscila entre 53,08 % y 57,26 %. Aunque las variables finales a 600 min están dentro de tolerancia respecto de `solveSteadyState()`, la permanencia conjunta por 5 min comienza a 537,7 min: **FAIL** frente al límite de 360 min (72 veces el mayor tiempo integral configurado).

## No deriva e independencia de dt

Partiendo exactamente del estado estacionario, el máximo drift relativo fue:

| Duración | Máximo drift relativo |
|---:|---:|
| 30 min | `7,80·10⁻6` |
| 60 min | `1,33·10⁻5` |
| 120 min | `1,99·10⁻5` |

Se incluyeron P80 OF, P80 molino, CL, nivel, densidad, FUF, FOF, inventario, potencia, agua del molino y agua del sump. La prueba transitoria de `dt = 0,5/1/2 s` contra referencia `0,1 s` pasa en las nueve variables principales con tolerancia relativa `10⁻5`.

## Conservación prolongada

| Duración | Residual sólidos t | Error relativo sólidos | Residual agua t | Error relativo agua |
|---:|---:|---:|---:|---:|
| 10 min | `1,99·10⁻12` | `1,20·10⁻13` | `-6,06·10⁻13` | `4,37·10⁻14` |
| 60 min | `8,85·10⁻12` | `8,85·10⁻14` | `-2,88·10⁻12` | `3,47·10⁻14` |
| 240 min | `1,56·10⁻11` | `3,90·10⁻14` | `-5,92·10⁻12` | `1,78·10⁻14` |

## Wi y régimen operativo

| Wi kWh/t | P80 OF µm | Potencia kW | Energía específica kWh/t | CL % |
|---:|---:|---:|---:|---:|
| 14 | 102,44 | 364,32 | 3,64 | 234,20 |
| 17 | 119,94 | 377,45 | 3,77 | 375,54 |

Ambos casos convergen y el mineral más duro da producto más grueso en esta formulación. Ninguno está limitado por la potencia disponible de 2024 kW; por ello el resultado se registra como comportamiento del modelo empírico, no como validación energética externa.

## Capacidad predicha por el modelo actual

| Feed t/h | Convergió | Potencia kW | Utilización % | P80 OF µm | Inventario t | CL % |
|---:|:---:|---:|---:|---:|---:|---:|
| 50 | Sí | 364,32 | 18,00 | 54,43 | 2,86 | 71,83 |
| 100 | Sí | 364,32 | 18,00 | 102,44 | 11,14 | 234,20 |
| 150 | **No** | 446,00 | 22,04 | 113,64 | 18,73 | 274,60 |
| 200 | **No** | 519,80 | 25,68 | 114,82 | 21,83 | 227,44 |

No se detecta un límite de potencia entre 50 y 200 t/h. Los valores de 150/200 t/h son el último estado finito del horizonte, no estados estacionarios aceptados. Esta tabla es **capacidad predicha por el modelo actual**, no capacidad de diseño validada.

## Sensibilidad local ±10 %

La tabla completa está en `TEST_RESULTS.json`. Todas las corridas permanecieron finitas y convergieron. Las sensibilidades más fuertes del caso base fueron CL frente a potencia, feed y Wi (aproximadamente −22 % a +35 %), y P80 OF frente a esas mismas entradas (aproximadamente −8 % a +11 %). El nivel del sump casi no cambia porque el controlador lo lleva al setpoint. Estos resultados sirven para detectar y calibrar sensibilidades; no constituyen validación externa.

## VERIFICADO MATEMÁTICAMENTE

- balances de sólidos y agua;
- propiedades de pulpa;
- conservación de sólidos por clase en la función de rotura;
- cierre de ciclón por clase y global;
- interpolación logarítmica y límites de P80.

## VERIFICADO NUMÉRICAMENTE

- RK4 e independencia de `dt`;
- reloj 1×/5×/10×/20× y render 30/60/120 FPS;
- no deriva a 30/60/120 min;
- conservación prolongada a 10/60/240 min;
- finitud, límites y anti-windup de los controles probados.

## IMPLEMENTADO / CALIBRABLE

- cinética de molienda;
- d50 operativo;
- partición de sólidos y water split del ciclón.

## PROVISIONAL

- bomba y curva hidráulica implícita;
- controles de nivel y agua;
- correcciones hidráulicas por presión, geometría y densidad.

## NO VALIDADO EXTERNAMENTE

- contra datos de planta;
- contra Moly-Cop;
- contra BALLSIM;
- contra JKSimMet;
- contra cualquier software comercial.

## Cierre de iteración 2026-08-17

Esta sección sustituye las cifras históricas de potencia/capacidad y respuesta dinámica que permanezcan arriba como trazabilidad de la auditoría anterior.

- Suite disponible: **205/205 PASS**, 0 pruebas fallidas. `TEST_RESULTS.json` contiene el resultado reproducible.
- Los casos de proceso a 150 y 200 t/h no se reclasificaron como convergentes: los tests PASS comprueban que el motor detecta la inviabilidad hidráulica/capacidad.
- Límite energético predicho: entre 125 y 150 t/h. En el escenario hidráulicamente no limitante, 125 t/h requiere ≈2109 kW; a 150 t/h la demanda es ≈5413 kW, la disponibilidad 2200 kW y `energyAvailability≈0,406`.
- Límite hidráulico predicho con parámetros base: entre 100 y 125 t/h; 125 t/h es el primer punto discreto clasificado `HYDRAULIC_CAPACITY_EXCEEDED`.
- F_UF era la última variable del arranque original por el lazo recirculante molino–sump–bomba–ciclón, el volumen/residencia del sump y el split UF≈70,08 %, además de su tolerancia más estricta. Su constante efectiva original era ≈90,87 min. Sin cambiar tau ni PI, el modelo energético cerrado entrega T95/T99 de 125,83/151,17 min.
- La potencia usada ahora es `min(P_available,P_required)` y limita explícitamente las tasas de rotura. Se corrigió el mecanismo ausente en el que más feed eleva la demanda, satura la potencia, reduce energía específica y deteriora P80.

Pendientes no ejecutados por cierre de cuota: refinar los umbrales con una malla más fina, calibrar energía/rotura con datos de planta, incorporar capacidad de ciclones respaldada, acordar criterios operacionales y repetir la sensibilidad dinámica completa del modelo energético nuevo. No se efectuaron ajustes de tau, PI, d50 ni water split.
